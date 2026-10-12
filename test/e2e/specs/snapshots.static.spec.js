const fs = require('fs');
const path = require('path');
const {test, expect} = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test.describe('complete Kong configuration backups', () => {
  test('captures modern Kong entities and sensitive credential collections', () => {
    const service = read('api/services/SnapshotsService.js');
    for (const entity of [
      'ca_certificates', 'key_sets', 'keys', 'vaults', 'targets',
      'key_auth_credentials', 'hmac_auth_credentials',
      'jwt_credentials', 'oauth2_credentials', 'oauth2_tokens'
    ]) {
      expect(service).toContain(entity);
    }
    expect(service).toContain('consumer_group_consumers');
    expect(service).toContain('BACKUP_VERSION = 2');
    expect(service).not.toContain("{key: 'basic_auth_credentials'");
    expect(service).toContain('basic_auth_credentials_one_way_password_hashes');
    expect(service).toContain('oauth2_credentials_with_one_way_hashed_client_secrets');
  });

  test('documents included, unavailable, excluded, and sensitive data', () => {
    const details = read('assets/js/app/snapshots/views/snapshot.html');
    const create = read('assets/js/app/snapshots/views/take-snapshot-modal.html');
    const listController = read('assets/js/app/snapshots/controllers/snapshots-list-controller.js');
    expect(details).toContain('snapshot.included_entities');
    expect(details).toContain('snapshot.unavailable_entities');
    expect(details).toContain('snapshot.excluded_entities');
    expect(create).toContain('sensitive credentials');
    expect(create).toContain('external vault backends');
    expect(create).toContain('one-way hashes');
    expect(create).toContain('hash_secret=true');
    expect(create).toContain('snapshot.include_sensitive_data');
    expect(create).toContain('Disabled by default');
    expect(listController).toContain("size : 'lg'");
    expect(create).toContain('class="modal-footer"');
  });

  test('reports imported, skipped, and failed restore objects', () => {
    const restore = read('assets/js/app/snapshots/views/snapshot-apply-modal.html');
    expect(restore).toContain('value.imported');
    expect(restore).toContain('value.skipped');
    expect(restore).toContain('value.failed.count');
    expect(restore).toContain('selectAll()');
  });

  test('scheduled snapshots persist and apply the sensitive-data option', () => {
    const model = read('api/models/SnapshotSchedule.js');
    const scheduler = read('api/services/SnapshotsScheduler.js');
    const controller = read('assets/js/app/snapshots/controllers/snapshots-scheduled-controller.js');
    const modal = read('assets/js/app/snapshots/views/snapshots-schedule-modal.html');
    expect(model).toContain('include_sensitive_data');
    expect(scheduler).toContain('includeSensitiveData: schedule.include_sensitive_data === true');
    expect(controller).toContain('include_sensitive_data: $scope.data.include_sensitive_data === true');
    expect(modal).toContain('data.include_sensitive_data');
    expect(modal).toContain('hash_secret=true');
  });

  test('snapshot file import uses a native JSON file chooser', () => {
    const list = read('assets/js/app/snapshots/views/snapshots-list.html');
    const controller = read('assets/js/app/snapshots/controllers/snapshots-list-controller.js');
    expect(list).toContain('for="import-snapshot"');
    expect(list).toContain('accept=".json,application/json"');
    expect(controller).not.toContain('$("#import-snapshot").click()');
    expect(controller).toContain('Snapshot imported successfully');
  });
});
