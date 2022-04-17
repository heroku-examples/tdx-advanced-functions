public with sharing class ChargingStationsQueueable implements Queueable {
  protected String jobId;
  protected DeliveryWaypoint__c waypoint;

  public ChargingStationsQueueable(String jobId, DeliveryWaypoint__c waypoint) {
    this.jobId = jobId;
    this.waypoint = waypoint;
  }

  public void execute(QueueableContext context) {
    try {
      ChargingStationsFunction.Input input = new ChargingStationsFunction.Input();
      System.debug(
        'Scheduling Job: ' +
        jobId +
        ' for waypoint: ' +
        waypoint.Id
      );
      input.jobId = this.jobId;
      input.waypointId = this.waypoint.id;
      ChargingStationsFunction.execute(
        input,
        new ChargingStationsFunction.Callback(this.jobId)
      );
    } catch (Exception ex) {
      System.debug(ex);
    }
  }
}
