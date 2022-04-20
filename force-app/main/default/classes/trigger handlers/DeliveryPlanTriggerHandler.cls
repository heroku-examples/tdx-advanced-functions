public with sharing class DeliveryPlanTriggerHandler {
  protected List<DeliveryPlan__ChangeEvent> events;
  public DeliveryPlanTriggerHandler(List<DeliveryPlan__ChangeEvent> events) {
    this.events = events;
    handleDeliveryPlan();
  }

  private void handleDeliveryPlan() {
    for (DeliveryPlan__ChangeEvent event : events) {
      EventBus.ChangeEventHeader header = event.ChangeEventHeader;
      if (header.changetype == 'CREATE') {
        handleCreate(header.getRecordIds().get(0));
      }
    }
  }

  private void handleCreate(Id deliveryPlanId) {
    List<DeliveryWaypoint__c> waypoints = [
      SELECT Id
      FROM DeliveryWaypoint__c
      WHERE DeliveryRoute__r.DeliveryPlan__c = :deliveryPlanId
      WITH SECURITY_ENFORCED
    ];

    Integer jobs = waypoints.size();
    if (jobs == 0) {
      System.debug(
        'No waypoints found for this delivery plan. Ignoring execution.'
      );
      // Should we trigger the event to notify the frontend? Maybe
      return;
    }

    // Execute the Job
    ChargingStationsController.execute(waypoints);
  }
}
