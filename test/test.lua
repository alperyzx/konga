-- Kong `pre-function` — access phase
--
-- Weighted split between a VM pool (plain HTTP, HTTP health checks) and an
-- OpenShift pool (TLS, HTTPS health checks), with failover when one side is
-- fully down.
--
-- Design rule: this is a *routing hint*, not a gate. Anything unexpected
-- degrades to "send it to the VM pool and leave the request alone" — the
-- script never returns an error page of its own.

local VM_UPSTREAM  = "channelsBackendUpstream_Avrupa"
local OCP_UPSTREAM = "channelsBackendUpstream_Openshift"

-- NOTE: Host header / TLS SNI is deliberately NOT handled here. Route
-- `channelsBackendRoute_Avrupa` has preserve_host = false, so Kong recomputes
-- $upstream_host during the balancer phase from
--   upstream.host_header  or  <resolved target hostname>
-- which clobbers anything set from `access`. The OpenShift Route hostname is
-- configured as `host_header` on channelsBackendUpstream_Openshift.

-- Percentage of traffic sent to OpenShift while both pools are healthy.
local OCP_PERCENT = 1

-- DIAGNOSTIC: pin a single request to one pool, bypassing the split.
--   x-channels-upstream: ocp   -> OpenShift
--   x-channels-upstream: vm    -> VM
-- Remove this once the split is proven; any client that learns the header
-- name can steer itself.
local FORCE_HEADER = "x-channels-upstream"

-- DIAGNOSTIC: log every routing decision. Set false once you are satisfied —
-- at production volume this writes one notice line per request.
local LOG_EVERY_DECISION = true

--------------------------------------------------------------------------

local balancer
do
  local ok, mod = pcall(require, "kong.runloop.balancer")
  if ok and type(mod) == "table" then
    balancer = mod
    kong.log.notice("channels-split: balancer module loaded, health-aware failover active")
  else
    -- Most likely `untrusted_lua = sandbox` blocking require. Degrade to a
    -- blind split rather than failing the request.
    kong.log.warn("channels-split: balancer module unavailable (", tostring(mod),
                  ") - health-aware failover disabled, split is blind")
  end
end

-- true  -> at least one target is usable
-- false -> every target is failing its health check
-- nil   -> unknown; callers must treat this as usable
local function is_up(name)
  if not balancer then
    return nil
  end

  local ok, res = pcall(function()
    local get_by_name = balancer.get_upstream_by_name
    if not get_by_name then
      return nil
    end

    -- name -> entity (cached in core_cache; this is not a DB round-trip)
    local upstream = get_by_name(name)
    if not upstream or not upstream.id then
      kong.log.warn("channels-split: no upstream named '", name, "'")
      return nil
    end

    -- Per-address health is the authoritative signal. The aggregate verdict
    -- from get_balancer_health() is gated on healthchecks.threshold, which is
    -- 0 on both of these upstreams, so it cannot be relied on here.
    --
    -- Shape: { ["host:port"] = { weight = {...},
    --                            addresses = { { ip =, port =, health = "..." } } } }
    -- Older releases put `health` directly on the target; handle both.
    if balancer.get_upstream_health then
      local info = balancer.get_upstream_health(upstream.id)
      if type(info) ~= "table" then
        return nil   -- balancer not built yet (e.g. first request after reload)
      end

      local known = false
      for _, target in pairs(info) do
        if type(target) == "table" then
          if type(target.addresses) == "table" then
            for _, addr in ipairs(target.addresses) do
              if addr.health then
                known = true
                if addr.health ~= "UNHEALTHY" then
                  return true
                end
              end
            end
          end
          if target.health then
            known = true
            if target.health ~= "UNHEALTHY" then
              return true
            end
          end
        end
      end

      if known then
        return false
      end
    end

    return nil
  end)

  if not ok then
    kong.log.warn("channels-split: health lookup failed for '", name, "': ", tostring(res))
    return nil
  end

  return res
end

-- Returns: prefer_ocp (boolean), reason (string)
local function decide()
  local forced = kong.request.get_header(FORCE_HEADER)
  if forced == "ocp" then
    return true, "forced by " .. FORCE_HEADER
  elseif forced == "vm" then
    return false, "forced by " .. FORCE_HEADER
  end

  local vm_ok  = is_up(VM_UPSTREAM)
  local ocp_ok = is_up(OCP_UPSTREAM)

  -- Only a definite UNHEALTHY counts as down; nil means "could not tell".
  if ocp_ok ~= false and vm_ok == false then
    return true, "vm pool unhealthy"
  elseif vm_ok ~= false and ocp_ok == false then
    return false, "openshift pool unhealthy"
  end

  local roll = math.random(100)
  return roll <= OCP_PERCENT,
         "split roll=" .. roll .. " threshold=" .. OCP_PERCENT ..
         " vm_ok=" .. tostring(vm_ok) .. " ocp_ok=" .. tostring(ocp_ok)
end

local function route_to(upstream, scheme)
  local pok, ok, err = pcall(kong.service.set_upstream, upstream)
  if not pok then
    kong.log.err("channels-split: set_upstream('", upstream, "') raised: ", tostring(ok))
    return false
  end
  if not ok then
    kong.log.err("channels-split: cannot select upstream '", upstream, "': ", tostring(err))
    return false
  end

  -- Scheme is the only thing worth overriding from here; see the Host note above.
  local sok, serr = pcall(kong.service.request.set_scheme, scheme)
  if not sok then
    kong.log.err("channels-split: set_scheme('", scheme, "') raised: ", tostring(serr))
    return false
  end

  return true
end

--------------------------------------------------------------------------

local prefer_ocp, reason = decide()

if LOG_EVERY_DECISION or prefer_ocp then
  kong.log.notice("channels-split: -> ", prefer_ocp and "OPENSHIFT" or "VM", " (", reason, ")")
end

if prefer_ocp then
  if not route_to(OCP_UPSTREAM, "https") then
    kong.log.warn("channels-split: openshift selection failed, falling back to vm")
    route_to(VM_UPSTREAM, "http")
  end
else
  if not route_to(VM_UPSTREAM, "http") then
    kong.log.warn("channels-split: vm selection failed, falling back to openshift")
    route_to(OCP_UPSTREAM, "https")
  end
end
