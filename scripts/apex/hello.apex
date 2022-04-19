// Use .apex files to store anonymous Apex.
// You can execute anonymous Apex in VS Code by selecting the
//     apex text and running the command:
//     SFDX: Execute Anonymous Apex with Currently Selected Text
// You can also execute the entire file by running the command:
//     SFDX: Execute Anonymous Apex with Editor Contents

functions.Function accountFunction = functions.Function.get('tdx_advanced_functions.routeplanner');
functions.FunctionInvocation invocation = accountFunction.invoke('{ "accountName": "Frisco Deliveries" }');
String jsonResponse = invocation.getResponse();
System.debug('Got response ' + jsonResponse);
// Log error, if applicable
if (invocation.getStatus() == functions.FunctionInvocationStatus.ERROR) {
    functions.FunctionInvocationError resultError = invocation.getError();
    if (resultError != null) {
        System.debug('Error type: ' + resultError.getType());
        System.debug('Error message: ' + resultError.getMessage());
    } else {
        System.debug('Error: UNKNOWN');
    }
    return;
}