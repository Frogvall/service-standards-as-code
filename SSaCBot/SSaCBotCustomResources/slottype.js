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

  if(!cfnRequestParams.hasOwnProperty('SlotTypeValueSelectionStrategy') || !cfnRequestParams.SlotTypeValueSelectionStrategy){
    cfnRequestParams.SlotTypeValueSelectionStrategy = 'ORIGINAL_VALUE '
  }

  let params = {
    name: cfnRequestParams.SlotTypeName,
    description: cfnRequestParams.SlotTypeDescription,
    valueSelectionStrategy: cfnRequestParams.SlotTypeValueSelectionStrategy,
    enumerationValues: cfnRequestParams.SlotTypeEnumerationValues
  };

  if (cfnRequestParams.hasOwnProperty('SlotTypeParentSlotTypeSignature')) {
    params.parentSlotTypeSignature = cfnRequestParams.SlotTypeParentSlotTypeSignature;
    params.slotTypeConfigurations = cfnRequestParams.SlotTypeConfigurations
  }  

  if (cfnRequestParams.hasOwnProperty('checksum')) {
    params.checksum = cfnRequestParams.checksum;
  }

  try {
    var result = await lexmodelbuildingservice.putSlotType(params).promise();
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

  const sameName = cfnRequestParams.SlotTypeName === oldCfnRequestParams.SlotTypeName

  if (cfnRequestParams.checksum || !sameName) {
    console.log('Name change or checksum provided, do not need to look up.')
    return await upsertHandler(cfnRequestParams);
  }

  console.log('Name is same and no checksum provided, must acquire to update.')

  try {
    var attributes = await getSlotTypeAttrs(oldCfnRequestParams);
    cfnRequestParams.checksum = attributes.checksum;
    return await upsertHandler(cfnRequestParams);
  } catch (error) {
    throw error;
  }
};

async function getSlotTypeAttrs(props) {
  const latestVersion = '$LATEST'
  const params = {
    name: props.SlotTypeName,
    version: latestVersion
  }
  console.log('Accessing current slot version with getIntent: %j', params)
  try {
    let result = await lexmodelbuildingservice.getSlotType(params).promise();
    console.log('Got SlotType information back: %j', result)
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
    name: cfnRequestParams.SlotTypeName /* required */
  };

  try {
    var result = await lexmodelbuildingservice.deleteSlotType(params).promise();
  } catch (error) {
    console.error(`Could not delete intent with name ${cfnRequestParams.SlotTypeName}`);
  }

  return {
    PhysicalResourceId: cfnRequestParams.SlotTypeName,
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