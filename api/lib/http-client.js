'use strict';

class Request {
  constructor(method, url) {
    this.method = method.toUpperCase();
    this.url = url;
    this.requestHeaders = {};
    this.payload = undefined;
    this.form = null;
  }

  headers(values) {
    Object.assign(this.requestHeaders, values || {});
    return this;
  }

  header(name, value) {
    this.requestHeaders[name] = value;
    return this;
  }

  send(payload) {
    this.payload = payload;
    return this;
  }

  field(name, value) {
    this.ensureForm().append(name, String(value));
    return this;
  }

  attach(name, value) {
    const part = Buffer.isBuffer(value)
      ? new Blob([value])
      : value;
    this.ensureForm().append(name, part, name);
    return this;
  }

  ensureForm() {
    if (!this.form) this.form = new FormData();
    return this.form;
  }

  async execute() {
    const headers = new Headers(this.requestHeaders);
    let body;

    if (this.form) {
      body = this.form;
      // Fetch must generate the multipart boundary itself.
      headers.delete('content-type');
    } else if (this.payload !== undefined && this.method !== 'GET' && this.method !== 'HEAD') {
      if (typeof this.payload === 'string' || Buffer.isBuffer(this.payload)) {
        body = this.payload;
      } else {
        if (!headers.has('content-type')) headers.set('content-type', 'application/json');
        body = JSON.stringify(this.payload);
      }
    }

    try {
      const result = await fetch(this.url, {
        method: this.method,
        headers: headers,
        body: body
      });
      const text = await result.text();
      let parsed = text;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch (error) {
          // Preserve non-JSON response bodies as text.
        }
      } else {
        parsed = {};
      }

      return {
        body: parsed,
        error: result.ok ? null : new Error('HTTP ' + result.status),
        headers: Object.fromEntries(result.headers.entries()),
        status: result.status,
        statusCode: result.status
      };
    } catch (error) {
      if (!error.code && error.cause && error.cause.code) error.code = error.cause.code;
      return {
        body: {message: error.message},
        error: error,
        headers: {},
        status: 500,
        statusCode: 500
      };
    }
  }

  end(callback) {
    const promise = this.execute();
    if (callback) promise.then(callback);
    return promise;
  }
}

function request(method) {
  return function (url) {
    return new Request(method, url);
  };
}

module.exports = {
  delete: request('DELETE'),
  get: request('GET'),
  head: request('HEAD'),
  patch: request('PATCH'),
  post: request('POST'),
  put: request('PUT')
};
