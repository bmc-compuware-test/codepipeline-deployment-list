/**
* ALL BMC SOFTWARE PRODUCTS LISTED WITHIN THE MATERIALS ARE TRADEMARKS OF BMC SOFTWARE, INC. ALL OTHER COMPANY PRODUCT NAMES
* ARE TRADEMARKS OF THEIR RESPECTIVE OWNERS.
*
* (c) Copyright 2023 BMC Software, Inc.
* This code is licensed under MIT license (see LICENSE.txt for details)
*/
var index = require('../index.js');
const chai = require('chai');
var assert = chai.assert;

describe('#validateRequiredParms(ces_url, ces_token, srid)', function () 
{
  it(' should return false - null passed in', function ()
   {
    let output = index.validateRequiredParms(null, null, null);
    assert.isFalse(output);
  });

  it(' should return false - undefined passed in', function ()
  {
   let output = index.validateRequiredParms(undefined, undefined, undefined);
   assert.isFalse(output);
  });

  it(' should return false - "" passed in', function ()
  {
   let output = index.validateRequiredParms("", "", "");
   assert.isFalse(output);
  });

  it(' should return false - "" passed in', function ()
  {
   let output = index.validateRequiredParms("http://CES:48080/", "", "");
   assert.isFalse(output);
  });

  it(' should return false - "" passed in', function ()
  {
   let output = index.validateRequiredParms("", "abcd", "");
   assert.isFalse(output);
  });

  it(' should return false - "" passed in', function ()
  {
   let output = index.validateRequiredParms("", "", "cw09");
   assert.isFalse(output);
  });

  it(' should return false - "" passed in', function ()
  {
   let output = index.validateRequiredParms("http://CES:48080/", "abcd", "cw09");
   assert.isTrue(output);
  });
});

describe('#handleResponseBody(responseBody)', function () {
  it('should throw an exception - responseBody undefined', function () {
    assert.throw(function () { index.handleResponseBody(undefined) }, index.DeploymentListFailureException, 'No response was received from the deployment list request.');
  });

  it('should return successfully', function () {
    let responseBody = {
      "deployments": {
        "requestId": 245274,
        "setId": "S000385216",
        "environment": "PLAY",
        "status": "COMPLETED",
        "description": "",
        "createDateTime": "2023-08-14 09:48:11"
      }
    };
    let output = index.handleResponseBody(responseBody);
    assert.strictEqual(output, responseBody);
  });

  it('should handle an empty message array', function () {
    let responseBody = {
      setId: 'S000241246',
      url: 'http://ces:48226/ispw/cw09-47623/sets/S000241246',
      awaitStatus: {
        generateFailedCount: 0,
        generateSuccessCount: 1,
        hasFailures: false,
        statusMsg: 'ISPW: Set S000241246 - The generate request completed successfully for KEEPRG2 in PLAY004799. Job ID and name: J0861367 AMIKEE0G',
        taskCount: 1
      }
    };
    let output = index.handleResponseBody(responseBody);
    assert.strictEqual(output, responseBody);
  });
});