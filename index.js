/**
* ALL BMC SOFTWARE PRODUCTS LISTED WITHIN THE MATERIALS ARE TRADEMARKS OF BMC
* SOFTWARE, INC. ALL OTHER COMPANY PRODUCT NAMES ARE TRADEMARKS OF THEIR
* RESPECTIVE OWNERS.
*
* (c) Copyright 2023 BMC Software, Inc.
* This code is licensed under MIT license (see LICENSE.txt for details)
*/
const core = require('@actions/core');
const utils = require('@bmc-compuware/ispw-action-utilities');
const axios = require('axios').default;

try 
{
  let inputs = ['ces_url', 'ces_token', 'srid', 'todaysDate', 'priorWeek', 'startDate', 'endDate',
  'requestId', 'setId', 'environment', 'status'];
  inputs = utils.retrieveInputs(core, inputs);
  core.info('Code Pipeline: parsed inputs: ' + utils.convertObjectToJson(inputs));
  
  const requiredFields = ['ces_url', 'ces_token', 'srid'];
  if (!validateRequiredParms(inputs.ces_url, inputs.ces_token, inputs.srid)) 
  {
    throw new MissingArgumentException(
        'Inputs required for Code Pipeline deployment list are missing. ' +
      '\nSkipping the deployment list request....');
  }

  let requestBasePath = `/ispw/${inputs.srid}/deployments`;
  let requestQueryPath = prepareRequestQueryPath(inputs);
  const requestUrl = prepareRequestUrl(inputs.ces_url, requestBasePath, requestQueryPath);
  core.info('Code Pipeline: request url: ' + requestUrl.href); 
 
  getHttpGetPromise(requestUrl, inputs.ces_token)
      .then((response) => {
        core.info('Code Pipeline: received response body: ' +
         utils.convertObjectToJson(response.data));
        setOutputs(core, response.data);
        return handleResponseBody(response.data);
      },
      (error) => {
        // there was a problem with the request to CES
        if (error.response !== undefined) {
          core.info('Code Pipeline: received error code: ' + error.response.status);
          core.info('Code Pipeline: received error response body: ' +
            utils.convertObjectToJson(error.response.data));
          setOutputs(core, error.response.data);
          throw new DeploymentListFailureException(error.response.data.message);
        }
        throw error;
      })
      .then(() => console.log('The deployment list request completed successfully.'),
          (error) => {
            core.info(error.stack);
            core.setFailed(error.message);
          });

  // the following code will execute after the HTTP request was started,
  // but before it receives a response.
} 
catch (error) 
{
  if (error instanceof MissingArgumentException) 
  {
    core.setFailed(error.message);
  } 
  else 
  {
    core.info(error.stack);
    console.error('An error occurred while calling the deployment list');
    core.setFailed(error.message);
  }
}

function validateRequiredParms(ces_url, ces_token, srid) 
{
  let isValid = true;
  if (!utils.stringHasContent(ces_url)) 
  {
    isValid = false;
    console.error(`Missing input:ces_url must be specified.`); 
  }
  
  if (!utils.stringHasContent(ces_token)) 
  {
    isValid = false;
    console.error(`Missing input:ces_token must be specified.`); 
  }
  
  if (!utils.stringHasContent(srid)) 
  {
    isValid = false;
    console.error(`Missing input:srid must be specified.`); 
  }
  
  return isValid;
}

/**
 * Gets a promise for sending an http GET request
 * @param {URL} requestUrl the URL to send hte request to
 * @param {string} token the token to use during authentication
 * @return {Promise} the Promise for the request
 */
function getHttpGetPromise(requestUrl, token) {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'authorization': token,
    },
  };
  return axios.get(requestUrl.href, options);
}

function prepareRequestQueryPath(inputs)
{
  let requestQueryPath ="?";
  if (utils.stringHasContent(inputs.startDate)) 
  {
    requestQueryPath.concat(`startDate=${inputs.startDate}&`);
  }
  if (utils.stringHasContent(inputs.endDate)) 
  {
    requestQueryPath.concat(`endDate=${inputs.endDate}&`);
  }
  if (utils.stringHasContent(inputs.requestId)) 
  {
    requestQueryPath.concat(`requestId=${inputs.requestId}&`);
  }
  if (utils.stringHasContent(inputs.setId)) 
  {
    requestQueryPath.concat(`setId=${inputs.setId}&`);
  }
  if (utils.stringHasContent(inputs.environment)) 
  {
    requestQueryPath.concat(`environment=${inputs.environment}&`);
  }
  if (utils.stringHasContent(inputs.status)) 
  {
    requestQueryPath.concat(`status=${inputs.status}&`);
  }
  if(requestQueryPath.endsWith('&') || requestQueryPath.endsWith('?') || requestQueryPath.endsWith('?&') )
  {
    requestQueryPath = requestQueryPath.substring(0, requestQueryPath.length - 1);
  }
  core.info('Code Pipeline: Request Query Url PAth: ' + requestQueryPath);
  return requestQueryPath;
}

function prepareRequestUrl(cesUrl, requestBasePath, requestQueryPath) 
{
  let lowercaseUrl = cesUrl.toLowerCase();
  
  // remove trailing '/compuware' from url, if it exists  
  const cpwrIndex = lowercaseUrl.lastIndexOf('/compuware');
  if (cpwrIndex > 0) 
  {
    cesUrl = cesUrl.substr(0, cpwrIndex);
  }

  // remove trailing '/bmc' from url, if it exists
  const bmcIndex = lowercaseUrl.lastIndexOf('/bmc');
  if (bmcIndex > 0) 
  {
    cesUrl = cesUrl.substr(0, bmcIndex);
  }
    
  // remove trailing slash
  if (cesUrl.endsWith('/')) 
  {
    cesUrl = cesUrl.substr(0, cesUrl.length - 1);
  }

  const tempUrlStr = cesUrl.concat(requestBasePath, requestQueryPath);
  const url = new URL(tempUrlStr);
  return url;
}

/** *****************************************************************************************/
// END OF MAIN SCRIPT, START OF FUNCTION DEFINITIONS
/** *****************************************************************************************/

/**
 * Takes the fields from the response body and sends them to the outputs of
 * the job
 * @param {core} core github actions core
 * @param {*} responseBody the response body received from the REST API request
 */
function setOutputs(core, responseBody) {
  if (responseBody) {
    core.setOutput('output_json', utils.convertObjectToJson(responseBody));

    const isTimedOut = utils.stringHasContent(responseBody.message) &&
      responseBody.message.includes('timed out');
    core.setOutput('is_timed_out', isTimedOut);
  }
}

/**
 * Examines the given response body to determine whether an error occurred
 * during the deployment list request.
 * @param {*} responseBody The body returned from the CES request
 * @return {*} The response body object if the deployment list was successful,
 * else throws an error
 * @throws DeploymentListFailureException if there were failures during the deployment list
 */
function handleResponseBody(responseBody) {
  if (responseBody === undefined) {
    // empty response
    throw new DeploymentListFailureException(
        'No response was received from the deployment list request.');
  } 
  else 
  {
    // success
    return responseBody;
  }
}

/**
 * Error to throw when not all the arguments have been specified for the action.
 * @param  {string} message the message associated with the error
 */
function MissingArgumentException(message) {
  this.message = message;
  this.name = 'MissingArgumentException';
}
MissingArgumentException.prototype = Object.create(Error.prototype);

/**
 * Error to throw when the response for the deployment list request is incomplete
 *  or indicates errors.
 * @param  {string} message the message associated with the error
 */
function DeploymentListFailureException(message) {
  this.message = message;
  this.name = 'DeploymentListFailureException';
}
DeploymentListFailureException.prototype = Object.create(Error.prototype);


module.exports = {
  setOutputs,
  handleResponseBody,
  DeploymentListFailureException,
  MissingArgumentException
};
