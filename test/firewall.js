/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const assert = require('assert');
const extend = require('extend');
const proxyquire = require('proxyquire');
const {ServiceObject, util} = require('@google-cloud/common');
const promisify = require('@google-cloud/promisify');

let promisified = false;
const fakePromisify = extend({}, promisify, {
  promisifyAll: function(Class) {
    if (Class.name === 'Firewall') {
      promisified = true;
    }
  },
});

class FakeServiceObject extends ServiceObject {
  constructor(config) {
    super(config);
    this.calledWith_ = arguments;
  }
}

describe('Firewall', function() {
  let Firewall;
  let firewall;

  const COMPUTE = {
    projectId: 'project-id',
    createFirewall: util.noop,
  };
  const FIREWALL_NAME = 'tcp-3000';
  const DEFAULT_FIREWALL_NETWORK = 'global/networks/default';

  before(function() {
    Firewall = proxyquire('../src/firewall.js', {
      '@google-cloud/common': {
        ServiceObject: FakeServiceObject,
      },
      '@google-cloud/promisify': fakePromisify,
    });
  });

  beforeEach(function() {
    firewall = new Firewall(COMPUTE, FIREWALL_NAME);
  });

  describe('instantiation', function() {
    it('should promisify all the things', function() {
      assert(promisified);
    });

    it('should localize compute instance', function() {
      assert.strictEqual(firewall.compute, COMPUTE);
    });

    it('should localize the firewall name', function() {
      assert.strictEqual(firewall.name, FIREWALL_NAME);
    });

    it('should default to the global network', function() {
      assert.deepStrictEqual(firewall.metadata, {
        network: DEFAULT_FIREWALL_NETWORK,
      });
    });

    it('should inherit from ServiceObject', function() {
      const computeInstance = extend({}, COMPUTE, {
        createFirewall: {
          bind: function(context) {
            assert.strictEqual(context, computeInstance);
          },
        },
      });

      const firewall = new Firewall(computeInstance, FIREWALL_NAME);

      assert(firewall instanceof ServiceObject);

      const calledWith = firewall.calledWith_[0];

      assert.strictEqual(calledWith.parent, computeInstance);
      assert.strictEqual(calledWith.baseUrl, '/global/firewalls');
      assert.strictEqual(calledWith.id, FIREWALL_NAME);
      assert.deepStrictEqual(calledWith.methods, {
        create: true,
        exists: true,
        get: true,
        getMetadata: true,
      });
    });
  });

  describe('delete', function() {
    it('should call ServiceObject.delete', function(done) {
      FakeServiceObject.prototype.delete = function() {
        assert.strictEqual(this, firewall);
        done();
      };

      firewall.delete();
    });

    describe('error', function() {
      const error = new Error('Error.');
      const apiResponse = {a: 'b', c: 'd'};

      beforeEach(function() {
        FakeServiceObject.prototype.delete = function(callback) {
          callback(error, apiResponse);
        };
      });

      it('should return an error if the request fails', function(done) {
        firewall.delete(function(err, operation, apiResponse_) {
          assert.strictEqual(err, error);
          assert.strictEqual(operation, null);
          assert.strictEqual(apiResponse_, apiResponse);
          done();
        });
      });

      it('should not require a callback', function() {
        assert.doesNotThrow(function() {
          firewall.delete();
        });
      });
    });

    describe('success', function() {
      const apiResponse = {
        name: 'op-name',
      };

      beforeEach(function() {
        FakeServiceObject.prototype.delete = function(callback) {
          callback(null, apiResponse);
        };
      });

      it('should execute callback with Operation & Response', function(done) {
        const operation = {};

        firewall.compute.operation = function(name) {
          assert.strictEqual(name, apiResponse.name);
          return operation;
        };

        firewall.delete(function(err, operation_, apiResponse_) {
          assert.ifError(err);
          assert.strictEqual(operation_, operation);
          assert.strictEqual(operation_.metadata, apiResponse);
          assert.strictEqual(apiResponse_, apiResponse);
          done();
        });
      });

      it('should not require a callback', function() {
        assert.doesNotThrow(function() {
          firewall.delete();
        });
      });
    });
  });

  describe('setMetadata', function() {
    it('should make the correct API request', function(done) {
      const metadata = {};

      firewall.request = function(reqOpts) {
        assert.strictEqual(reqOpts.method, 'PATCH');
        assert.strictEqual(reqOpts.uri, '');
        assert.strictEqual(reqOpts.json, metadata);
        assert.deepStrictEqual(metadata, {
          name: firewall.name,
          network: DEFAULT_FIREWALL_NETWORK,
        });

        done();
      };

      firewall.setMetadata(metadata, assert.ifError);
    });

    it('should respect network specification', function(done) {
      const metadata = {network: 'custom-network'};

      firewall.request = function(reqOpts) {
        assert.strictEqual(reqOpts.json.network, metadata.network);
        done();
      };

      firewall.setMetadata(metadata, assert.ifError);
    });

    describe('error', function() {
      const error = new Error('Error.');
      const apiResponse = {a: 'b', c: 'd'};

      beforeEach(function() {
        firewall.request = function(reqOpts, callback) {
          callback(error, apiResponse);
        };
      });

      it('should return an error if the request fails', function(done) {
        firewall.setMetadata({e: 'f'}, function(err, op, apiResponse_) {
          assert.strictEqual(err, error);
          assert.strictEqual(op, null);
          assert.strictEqual(apiResponse_, apiResponse);
          done();
        });
      });
    });

    describe('success', function() {
      const apiResponse = {
        name: 'op-name',
      };

      beforeEach(function() {
        firewall.request = function(reqOpts, callback) {
          callback(null, apiResponse);
        };
      });

      it('should execute callback with operation & response', function(done) {
        const operation = {};
        const metadata = {a: 'b'};

        firewall.compute.operation = function(name) {
          assert.strictEqual(name, apiResponse.name);
          return operation;
        };

        firewall.setMetadata(metadata, function(err, op, apiResponse_) {
          assert.ifError(err);
          assert.strictEqual(op, operation);
          assert.strictEqual(op.metadata, apiResponse);
          assert.strictEqual(apiResponse_, apiResponse);
          done();
        });
      });

      it('should not require a callback', function() {
        assert.doesNotThrow(function() {
          firewall.setMetadata({a: 'b'});
        });
      });
    });
  });
});
