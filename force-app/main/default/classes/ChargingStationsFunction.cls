public with sharing class ChargingStationsFunction {
  public static void invoke(
    String payload,
    functions.FunctionCallback callback
  ) {
    functions.Function fn = functions.Function.get(
      'tdx_advanced_functions.chargingstations'
    );
    fn.invoke(payload, callback);
  }
}
