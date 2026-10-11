'use strict';

const assert = require('assert');
const http = require('http');
const client = require('../../api/lib/http-client');

describe('HTTP client', function () {
  let server;
  let baseUrl;

  before(function (done) {
    server = http.createServer(function (req, res) {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', function () {
        const body = Buffer.concat(chunks).toString();
        if (req.url === '/error') {
          res.writeHead(422, {'content-type': 'application/json'});
          return res.end(JSON.stringify({message: 'invalid'}));
        }
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify({method: req.method, body: body, contentType: req.headers['content-type']}));
      });
    });
    server.listen(0, '127.0.0.1', function () {
      baseUrl = 'http://127.0.0.1:' + server.address().port;
      done();
    });
  });

  after(function (done) {
    server.close(done);
  });

  it('sends and parses JSON', async function () {
    const response = await client.post(baseUrl + '/json').send({hello: 'world'}).end();
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.error, null);
    assert.strictEqual(response.body.method, 'POST');
    assert.deepStrictEqual(JSON.parse(response.body.body), {hello: 'world'});
    assert.strictEqual(response.body.contentType, 'application/json');
  });

  it('reports non-success responses without throwing', async function () {
    const response = await client.get(baseUrl + '/error').end();
    assert.strictEqual(response.statusCode, 422);
    assert(response.error);
    assert.deepStrictEqual(response.body, {message: 'invalid'});
  });

  it('builds multipart requests with a generated boundary', async function () {
    const response = await client.post(baseUrl + '/multipart')
      .header('content-type', 'multipart/form-data')
      .field('name', 'certificate')
      .attach('cert', Buffer.from('pem-data'))
      .end();
    assert.match(response.body.contentType, /^multipart\/form-data; boundary=/);
    assert.match(response.body.body, /name="name"\r\n\r\ncertificate/);
    assert.match(response.body.body, /pem-data/);
  });
});
