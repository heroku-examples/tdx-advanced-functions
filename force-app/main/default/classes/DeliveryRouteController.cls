public with sharing class DeliveryRouteController {
  @AuraEnabled
  public static void planDeliveryRoute(Id accountId) {
    try {
      Account account = [
        SELECT Name
        FROM Account
        WHERE Id = :accountId
        WITH SECURITY_ENFORCED
        LIMIT 1
      ];
      RoutePlannerFunction.execute(account.Name);
    } catch (Exception ex) {
      throw new AuraHandledException(ex.getMessage());
    }
  }

  @AuraEnabled(cacheable=true)
  public static List<DeliveryWaypoint__c> getWaypoints(Id deliveryPlanId) {
    try {
      return [
        SELECT
          Name,
          Service__r.Name,
          Service__r.Location__Latitude__s,
          Service__r.Location__Longitude__s,
          Number__c
        FROM DeliveryWaypoint__c
        WHERE DeliveryRoute__r.DeliveryPlan__c = :deliveryPlanId
        WITH SECURITY_ENFORCED
        ORDER BY CreatedDate DESC
      ];
    } catch (Exception ex) {
      throw new AuraHandledException(ex.getMessage());
    }
  }

  @AuraEnabled(cacheable=true)
  public static List<ChargingStation__c> getChargingStations(
    Id deliveryPlanId
  ) {
    try {
      List<ChargingStation__c> chargingStations = [
        SELECT
          Id,
          Name,
          Street_Address__c,
          City__c,
          State__c,
          Zip__c,
          Location__latitude__s,
          Location__longitude__s,
          Distance__c
        FROM ChargingStation__c
        WHERE
          Delivery_Waypoint__r.DeliveryRoute__r.DeliveryPlan__c = :deliveryPlanId
        WITH SECURITY_ENFORCED
        ORDER BY Distance__c
      ];
      return chargingStations;
    } catch (Exception e) {
      throw new AuraHandledException(e.getMessage());
    }
  }
}
