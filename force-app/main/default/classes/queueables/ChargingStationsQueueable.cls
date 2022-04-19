public with sharing class ChargingStationsQueueable implements Queueable {
  protected List<DeliveryWaypoint__c> waypoints;

  public ChargingStationsQueueable(List<DeliveryWaypoint__c> waypoints) {
    this.waypoints = waypoints;
  }

  public void execute(QueueableContext context) {
    // Schedule Job
    Integer jobs = waypoints.size();
    JobManagerFunction.JobStatus status = JobManagerFunction.execute(jobs);
    String jobId = status.jobId;
    // Retrieve Charging Stations by Waypoint in Parallel
    for (DeliveryWaypoint__c waypoint : waypoints) {
      ChargingStationsFunction.Input input = new ChargingStationsFunction.Input();
      System.debug(
        'Scheduling Job: ' +
        jobId +
        ' for waypoint: ' +
        waypoint.Id
      );
      input.jobId = jobId;
      input.waypointId = waypoint.id;
      ChargingStationsFunction.execute(
        input,
        new ChargingStationsFunction.Callback(jobId)
      );
    }
  }
}
