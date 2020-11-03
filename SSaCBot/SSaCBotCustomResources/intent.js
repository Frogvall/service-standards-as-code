'use strict';

const AWS = require('aws-sdk');
const lexmodelbuildingservice = new AWS.LexModelBuildingService({ apiVersion: '2017-04-19' });
const CfnLambda = require('cfn-lambda');

const wait = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, 2000);
  });
};

const upsertHandler = async (cfnRequestParams) => {
  console.log(CfnLambda.Environment);
  console.log('create called');
  console.log("params", JSON.stringify(cfnRequestParams));

  let params = {
    name: cfnRequestParams.IntentName,
    description: cfnRequestParams.IntentDescription,
    fulfillmentActivity: {
      type: "CodeHook",
      codeHook: {
        uri: cfnRequestParams.IntentFullfillmentLambdaArn,
        messageVersion: "1.0"
      }
    },
    followUpPrompt: {
      prompt: {
        messages: [
          {
            contentType: "PlainText",
            content: "Creating {serviceName}",
            groupNumber: 1
          },
          {
            contentType: "PlainText",
            content: "Thank you -> your service {serviceName} is being created",
            groupNumber: 1
          }
        ],
        maxAttempts: 3
      },
      rejectionStatement: {
        messages: [
          {
            contentType: "PlainText",
            content: "Sure, have it your way!",
            groupNumber: 1
          },
          {
            contentType: "PlainText",
            content: "Alright, another time then!",
            groupNumber: 1
          }
        ]
      }
    },
    sampleUtterances: [
      "Create Service",
      "Create Service with name {serviceName}",
      "New Service",
      "New Service with name {serviceName}",
      "New Service {serviceName}",
      "New Service with {runtime} and name {serviceName}"
    ],
    slots: [
      {
        name: "runtime",
        slotConstraint: "Required",
        slotType: "RuntimeVTwo",
        slotTypeVersion: "1",
        valueElicitationPrompt: {
          messages: [
            {
              contentType: "PlainText",
              content: "What runtime do you want to use?"
            },
            {
              contentType: "PlainText",
              content: "Runtime?"
            }
          ],
          maxAttempts: 2,
          responseCard: "{\"version\":1,\"contentType\":\"application/vnd.amazonaws.card.generic\",\"genericAttachments\":[{\"imageUrl\":\"https://imgflip.com/i/4er5gg\",\"title\":\"What runtime do you want to use\",\"buttons\":[{\"text\":\"Python\",\"value\":\"python\"},{\"text\":\"dotnet\",\"value\":\"dotnet\"},{\"text\":\"node\",\"value\":\"nodejs\"},{\"text\":\"typescript\",\"value\":\"typescript\"}]}]}"
        },
        priority: 2,
        sampleUtterances: [
          "Use {runtime}"
        ]
      },
      {
        name: "serviceName",
        slotConstraint: "Required",
        slotType: "ServiceNameRegExVTwo",
        slotTypeVersion: "1",
        valueElicitationPrompt: {
          messages: [
            {
              contentType: "PlainText",
              content: "What should the service be called"
            }
          ],
          maxAttempts: 2
        },
        priority: 4,
        sampleUtterances: []
      }
    ]
  };

  if (cfnRequestParams.hasOwnProperty('checksum')) {
    params.checksum = cfnRequestParams.checksum;
    console.log('adding checksum!');
  }

  console.log("the actual parameters for the put", JSON.stringify(params));

  try {
    var result = await lexmodelbuildingservice.putIntent(params).promise();
  } catch (error) {
    console.error(error);
    throw error;
  }

  return {
    PhysicalResourceId: result.name,
    FnGetAttrsDataObj: {
      checksum: result.checksum,
      version: result.version
    }
  };
};

const updateHandler = async (requestPhysicalId, cfnRequestParams, oldCfnRequestParams) => {
  console.log('update called');
  console.log("id", requestPhysicalId);
  console.log(CfnLambda.Environment);
  console.log("params", JSON.stringify(cfnRequestParams));

  const sameName = cfnRequestParams.IntentName === oldCfnRequestParams.IntentName

  if (cfnRequestParams.checksum || !sameName) {
    console.log('Name change or checksum provided, do not need to look up.')
    return await upsertHandler(cfnRequestParams);
  }

  console.log('Name is same and no checksum provided, must acquire to update.')

  try {
    var attributes = await getIntentAttrs(oldCfnRequestParams);
    cfnRequestParams.checksum = attributes.checksum;
    return await upsertHandler(cfnRequestParams);
  } catch (error) {
    throw error;
  }
};

async function getIntentAttrs(props) {
  const latestVersion = '$LATEST'
  const params = {
    name: props.IntentName,
    versionOrAlias: latestVersion
  }
  console.log('Accessing current slot version with getIntent: %j', params)
  try {
    let result = await lexmodelbuildingservice.getIntent(params).promise();
    console.log('Got Intent information back: %j', result)
    return {
      checksum: result.checksum,
      version: latestVersion
    }
  } catch (error) {
    console.error('Problem accessing data during read to Bot: %j', error);
    throw error;
  }
}


const deleteHandler = async (requestPhysicalId, cfnRequestParams) => {
  console.log('delete called');
  console.log("id", requestPhysicalId);
  console.log(CfnLambda.Environment);
  console.log("params", JSON.stringify(cfnRequestParams));

  var params = {
    name: cfnRequestParams.IntentName /* required */
  };

  try {
    var result = await lexmodelbuildingservice.deleteIntent(params).promise();
  } catch (error) {
    console.error(`Could not delete intent with name ${cfnRequestParams.IntentName}`);
  }

  return {
    PhysicalResourceId: cfnRequestParams.IntentName,
  }
};

const noUpdateHandler = async (requestPhysicalId, cfnRequestParams) => {
  console.log('Noop update must drive "version" and "checksum" attributes.')
  try {
    var attributes = await getIntentAttrs(cfnRequestParams);   
    return {
      PhysicalResourceId: requestPhysicalId,
      FnGetAttrsDataObj: {
        checksum: attributes.checksum,
        version: attributes.version
      }
    };
  } catch (error) {
    throw error;
  }
}

module.exports.deploy = CfnLambda({

  AsyncCreate: upsertHandler, // Required function
  AsyncUpdate: updateHandler, // Required function
  AsyncDelete: deleteHandler, // Required function
  AsyncNoUpdate: noUpdateHandler,

  // Any of following to validate resource Properties
  // If you do not include any, the Lambda assumes any Properties are valid.
  // If you define more than one, the system uses all of them in this order.
  // Validate: Validate,     // Function
  // Schema: Schema,         // JSONSchema v4 Object
  // SchemaPath: SchemaPath, // Array path to JSONSchema v4 JSON file
  // end list

  // AsyncNoUpdate: noUpdateHandler, // Optional
  // TriggersRepla ement: TriggersReplacement, // Array<String> of properties forcing Replacement

  // LongRunning: <see Long Running below> // Optional. Configure a lambda to last beyond 5 minutes.

});