public with sharing class RoutePlannerFunction {
  public static void execute(String accountName) {
    functions.Function fn = functions.Function.get(
      'tdx_advanced_functions.routeplanner'
    );
    functions.FunctionInvocation invocation = fn.invoke(
      '{ "accountName": "' +
      accountName +
      '" }'
    );

    // Check if there is any error during the invocation
    if (invocation.getStatus() == functions.FunctionInvocationStatus.ERROR) {
      String errorMessage = invocation.getError() != null
        ? invocation.getError().getMessage()
        : 'UNKNOWN';
      System.debug(errorMessage);
      throw new CalloutException(errorMessage);
    }
  }
}
