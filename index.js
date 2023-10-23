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
  let buildParms;
  let inputs = ['ces_url', 'ces_token', 'srid', 'todaysDate', 'priorWeek', 'startDate', 'endDate',
  'requestId', 'setId', 'environment', 'status'];
  inputs = utils.retrieveInputs(core, inputs);
  core.info('Code Pipeline: parsed inputs: ' + utils.convertObjectToJson(inputs));

  /*
  if (utils.stringHasContent(inputs.generate_automatically)) {
    console.log('Generate parameters are being retrieved from the ' +
      'generate_automatically input.');
    buildParms = utils.parseStringAsJson(inputs.generate_automatically);
  } else {
    console.log('Generate parameters are being retrieved from the inputs.');
    buildParms = getParmsFromInputs(inputs.assignment_id, inputs.level, inputs.task_id);
  }
  core.info('Code Pipeline: parsed buildParms: ' + utils.convertObjectToJson(buildParms));

  //const requiredFields = ['containerId', 'taskLevel', 'taskIds'];
  if (!utils.validateBuildParms(buildParms, requiredFields)) {
    throw new MissingArgumentException(
        'Inputs required for Code Pipeline Generate are missing. ' +
      '\nSkipping the generate request....');
  }*/

  //const reqPath = getGenerateAwaitUrlPath(inputs.srid, buildParms);
  //const reqUrl = utils.assembleRequestUrl(inputs.ces_url, reqPath);
  let reqPath = `/ispw/${inputs.srid}/deployments`;
  const reqUrl = prepareRequestUrl(inputs.ces_url, reqPath);
  core.info('Code Pipeline: request url: ' + reqUrl.href); 
  core.info('Code Pipeline: request url: ' + reqUrl); 
  const reqBodyObj = prepareRequestBodyObject(inputs.todaysDate, inputs.priorWeek, inputs.startDate,
     inputs.endDate, inputs.requestId,inputs.setId, inputs.environment, inputs.status);
  core.info('Code Pipeline: reqBodyObj : ' + reqBodyObj); 
  core.info('Code Pipeline: reqBodyObj : ' + reqBodyObj); 
  core.info('Code Pipeline: token : ' + inputs.ces_token);
  getHttpGetPromise(reqUrl, inputs.ces_token, reqBodyObj)
      .then((response) => {
        core.info('Code Pipeline: received response body: ' +
         utils.convertObjectToJson(response.data));
        // generate could have passed or failed
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
          throw new GenerateFailureException(error.response.data.message);
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
  //console.log('Starting the generate process for task ' + buildParms.taskIds.toString());
} catch (error) {
  if (error instanceof MissingArgumentException) {
    // this would occur if there was nothing to load during the sync process
    // no need to fail the action if the generate is never attempted
    console.log(error.message);
  } else {
    core.info(error.stack);
    console.error('An error occurred while starting the generate');
    core.setFailed(error.message);
  }
}

/**
 * Gets a promise for sending an http POST request
 * @param {URL} requestUrl the URL to send hte request to
 * @param {string} token the token to use during authentication
 * @param {*} requestBody the request body object
 * @return {Promise} the Promise for the request
 */
function getHttpGetPromise(requestUrl, token, requestBody) {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'authorization': token,
    },
  };
  return axios.get(requestUrl.href, requestBody, options);
}

function prepareRequestUrl(cesUrl, requestPath) 
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

  const tempUrlStr = cesUrl.concat(requestPath);
  const url = new URL(tempUrlStr);
  return url;
}

/** *****************************************************************************************/
// END OF MAIN SCRIPT, START OF FUNCTION DEFINITIONS
/** *****************************************************************************************/

/**
 * Uses the input parameters from the action metadata to fill in a BuildParms
 * object.
 * @param  {string} inputAssignment the assignmentId passed into the action
 * @param  {string} inputLevel the Code Pipeline level passed into the action
 * @param  {string} inputTaskId the comma separated list of task IDs passed
 * into the action
 * @return {BuildParms} a BuildParms object with the fields filled in.
 * This will never return undefined.
 */
function getParmsFromInputs(inputAssignment, inputLevel, inputTaskId) {
  const buildParms = {};
  if (utils.stringHasContent(inputAssignment)) {
    buildParms.containerId = inputAssignment;
  }

  if (utils.stringHasContent(inputLevel)) {
    buildParms.taskLevel = inputLevel;
  }

  if (utils.stringHasContent(inputTaskId)) {
    buildParms.taskIds = inputTaskId.split(',');
  }
  return buildParms;
}

/**
 * Takes the fields from the response body and sends them to the outputs of
 * the job
 * @param {core} core github actions core
 * @param {*} responseBody the response body received from the REST API request
 */
function setOutputs(core, responseBody) {
  if (responseBody) {
    core.setOutput('output_json', utils.convertObjectToJson(responseBody));
    core.setOutput('set_id', responseBody.setId);
    core.setOutput('url', responseBody.url);

    const isTimedOut = utils.stringHasContent(responseBody.message) &&
      responseBody.message.includes('timed out');
    core.setOutput('is_timed_out', isTimedOut);

    if (responseBody.awaitStatus) {
      core.setOutput('generate_failed_count', responseBody.awaitStatus.generateFailedCount);
      core.setOutput('generate_success_count', responseBody.awaitStatus.generateSuccessCount);
      core.setOutput('has_failures', responseBody.awaitStatus.hasFailures);
      core.setOutput('task_count', responseBody.awaitStatus.taskCount);
    }
  }
}

/**
 * Gets the request path for the CES REST api generate-await on tasks. The returned path starts with
 * '/ispw/' and ends with the query parameters
 * @param {string} srid The SRID for this instance of Code Pipeline
 * @param {*} buildParms The build parms to use when filling out the request url
 * @return {string} the request path which can be appended to the CES url
 */
function getGenerateAwaitUrlPath(srid, buildParms) {
  let tempUrlStr = `/ispw/${srid}/assignments/${buildParms.containerId}`;
  tempUrlStr = tempUrlStr.concat('/taskIds/generate-await?');
  buildParms.taskIds.forEach((id) => {
    tempUrlStr = tempUrlStr.concat(`taskId=${id}&`);
  });
  tempUrlStr = tempUrlStr.concat(`level=${buildParms.taskLevel}`);
  return tempUrlStr;
}

/**
 * Prepares an object for the CES request body.
 * @param  {string | undefined} runtimeConfig the runtime configuration passed
 * in the inputs
 * @param  {string | undefined} changeType the change type passed in the inputs
 * @param  {string | undefined} executionStatus the execution status passed
 * in the inputs
 * @param  {string | undefined} autoDeploy whether to auto deploy
 * @return {any} an object with all the fields for the request body filled in
 */
function prepareRequestBodyObject(todaysDate, priorWeek, startDate,
  endDate, requestId, setId, environment, status) 
  {
    const requestBody = {};
    if (utils.stringHasContent(todaysDate)) 
    {
      requestBody.todaysDate = todaysDate;
    }
    if (utils.stringHasContent(priorWeek)) 
    {
      requestBody.priorWeek = priorWeek;
    }
    if (utils.stringHasContent(startDate)) 
    {
      requestBody.startDate = startDate;
    }
    if (utils.stringHasContent(endDate)) 
    {
      requestBody.endDate = endDate;
    }
    if (utils.stringHasContent(requestId)) 
    {
      requestBody.requestId = requestId;
    }
    if (utils.stringHasContent(setId)) 
    {
      requestBody.setId = setId;
    }
    if (utils.stringHasContent(environment)) 
    {
      requestBody.environment = environment;
    }
    if (utils.stringHasContent(status))
    {
      requestBody.status = status;
    }
  return requestBody;
}

/**
 * Examines the given response body to determine whether an error occurred
 * during the generate.
 * @param {*} responseBody The body returned from the CES request
 * @return {*} The response body object if the generate was successful,
 * else throws an error
 * @throws GenerateFailureException if there were failures during the generate
 */
function handleResponseBody(responseBody) {
  if (responseBody === undefined) {
    // empty response
    throw new GenerateFailureException(
        'No response was received from the generate request.');
  } else if (responseBody.awaitStatus === undefined) {
    // Generate did not complete - there should be a message returned
    if (responseBody.message !== undefined) {
      throw new GenerateFailureException(responseBody.message);
    }
    throw new GenerateFailureException('The generate request did not complete successfully.');
  } else if (responseBody.awaitStatus.generateFailedCount !== 0) {
    // there were generate failures
    console.error(utils.getStatusMessageToPrint(responseBody.awaitStatus.statusMsg));
    throw new GenerateFailureException('There were generate failures.');
  } else {
    // success
    console.log(utils.getStatusMessageToPrint(responseBody.awaitStatus.statusMsg));
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
 * Error to throw when the response for the generate request is incomplete
 *  or indicates errors.
 * @param  {string} message the message associated with the error
 */
function GenerateFailureException(message) {
  this.message = message;
  this.name = 'GenerateFailureException';
}
GenerateFailureException.prototype = Object.create(Error.prototype);


module.exports = {
  getParmsFromInputs,
  setOutputs,
  getGenerateAwaitUrlPath,
  prepareRequestBodyObject,
  handleResponseBody,
  MissingArgumentException,
  GenerateFailureException,
};
