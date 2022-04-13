public with sharing class DeliveryRouteController {
  // Uncomment if deploying to a Functions Enabled Org
  // @AuraEnabled(cacheable=true)
  // public static String calculate(String accountName) {
  //   // Payload
  //   Input input = new Input();
  //   input.accountName = accountName;
  //   // Invoke Function Async
  //   Functions.FunctionInvocation invocation = Functions.Function.get(
  //       'RouterPlanner'
  //     )
  //     .invoke(JSON.serialize(input), new RouterPlannerResponseHandler());
  //   return invocation.getInvocationId();
  // }

  // public class RouterPlannerResponseHandler implements Functions.FunctionCallback {
  //   public void handleResponse(functions.FunctionInvocation result) {
  //     // Deserialize reponse
  //     Output output = (Output) JSON.deserialize(
  //       result.getResponse(),
  //       Output.class
  //     );
  //     // Output invocation id, message and error to debug log
  //     System.debug(
  //       result.getInvocationId() +
  //       ' : ' +
  //       output.message +
  //       ' : ' +
  //       result.getError()
  //     );
  //   }
  // }

  // public class Input {
  //   public String accountName;
  // }

  // public class Output {
  //   public String message;
  // }

  @AuraEnabled(cacheable=true)
  public static List<DeliveryWaypoint__c> getWaypoints(String someValue) {
    return [
      SELECT
        Name,
        Service__r.Name,
        Service__r.LocationX__c,
        Service__r.LocationY__c,
        Number__c
      FROM DeliveryWaypoint__c
      ORDER BY CreatedDate DESC
      LIMIT 5
    ];
  }
}
