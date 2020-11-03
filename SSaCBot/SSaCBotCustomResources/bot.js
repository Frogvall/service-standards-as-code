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

  var params = {
    name: cfnRequestParams.BotName,
    abortStatement: {
      messages: [
        {
          content: "I don't understand. Can you try again?",
          contentType: "PlainText"
        },
        {
          content: "I'm sorry, I don't understand.",
          contentType: "PlainText"
        }
      ]
    },
    childDirected: true,
    clarificationPrompt: {
      maxAttempts: 1,
      messages: [
        {
          content: "I'm sorry, I didn't hear that. Can you repeat what you just said?",
          contentType: "PlainText"
        },
        {
          content: "Can you say that again?",
          contentType: "PlainText"
        }
      ]
    },
    description: cfnRequestParams.BotDescription,
    idleSessionTTLInSeconds: 300,
    locale: "en-US",
    processBehavior: "SAVE"
  };

  if (cfnRequestParams.hasOwnProperty('checksum')) {
    params.checksum = cfnRequestParams.checksum;
    console.log('adding checksum!');
  }

  console.log("the actual parameters for the put", JSON.stringify(params));

  try {
    var result = await lexmodelbuildingservice.putBot(params).promise();
  } catch (error) {
    console.error(error);
    throw error;
  }

  console.log("da result", JSON.stringify(result));

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

  const sameName = cfnRequestParams.BotName === oldCfnRequestParams.BotName

  if (cfnRequestParams.checksum || !sameName) {
    console.log('Name change or checksum provided, do not need to look up.')
    return await upsertHandler(cfnRequestParams);
  }

  console.log('Name is same and no checksum provided, must acquire to update.')

  try {
    var attributes = await getBotAttrs(oldCfnRequestParams);
    cfnRequestParams.checksum = attributes.checksum;
    return await upsertHandler(cfnRequestParams);
  } catch (error) {
    throw error;
  }
};

// Because of checksum requirements for Update and NoUpdate, we need to be able
//   to pull the checksum of version, to drive (1) passing to Amazon Lex on
//   putBot calls where the named Bot already exists, or (2) to pass
//   params for Fn::GetAtt to use when a no-change UPDATE is passed due to
//   explicit DependsOn propagations in a template.
async function getBotAttrs(props) {
  const latestVersion = '$LATEST'
  const botParams = {
    name: props.BotName,
    versionOrAlias: latestVersion
  }
  console.log('Accessing current slot version with getBot: %j', botParams)
  try {
    var result = await lexmodelbuildingservice.getBot(botParams).promise();
    console.log('Got Bot information back: %j', result)
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
    name: cfnRequestParams.BotName /* required */
  };

  try {
    var result = await lexmodelbuildingservice.deleteBot(params).promise();
  } catch (error) {
    console.error(`Could not delete bot with name ${cfnRequestParams.BotName}`);
  }

  return {
    PhysicalResourceId: cfnRequestParams.BotName,
  }  
};

const noUpdateHandler = async (requestPhysicalId, cfnRequestParams) => {
  console.log('Noop update must drive "version" and "checksum" attributes.')
  try {
    var attributes = await getBotAttrs(cfnRequestParams);   
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