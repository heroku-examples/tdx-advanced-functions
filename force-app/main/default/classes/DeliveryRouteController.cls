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

  @AuraEnabled
  public static void loadChargingStations(Id deliveryPlanId) {
    try {
      List<DeliveryWaypoint__c> waypoints = [
        SELECT Id
        FROM DeliveryWaypoint__c
        WHERE DeliveryRoute__r.DeliveryPlan__c = :deliveryPlanId
        WITH SECURITY_ENFORCED
      ];
      Integer jobs = waypoints.size();
      if (jobs == 0) {
        throw new AuraHandledException(
          'No waypoints found for this delivery plan.'
        );
      }
      // Schedule Job
      JobManagerFunction.JobStatus status = JobManagerFunction.execute(jobs);
      // Retrieve Charging Stations by Waypoint in Parallel
      for (DeliveryWaypoint__c waypoint : waypoints) {
        System.enqueueJob(
          new ChargingStationsQueueable(status.jobId, waypoint)
        );
      }
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
}
