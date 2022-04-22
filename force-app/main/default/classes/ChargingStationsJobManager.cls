public with sharing class ChargingStationsJobManager {
  public static void execute(List<DeliveryWaypoint__c> waypoints) {
    Integer jobs = waypoints.size();
    if (jobs == 0) {
      System.debug(
        'No waypoints found for this delivery plan. Ignoring execution.'
      );
      // Should we trigger the event to notify the frontend? Maybe
      return;
    }
    JobManagerFunction.executeAsync(jobs, new Callback(waypoints));
  }

  // Job Manager Callback
  private class Callback extends JobManagerFunction.Callback {
    protected List<DeliveryWaypoint__c> waypoints;
    public Callback(List<DeliveryWaypoint__c> waypoints) {
      this.waypoints = waypoints;
    }

    public override void handleJobStatus(JobManagerFunction.JobStatus status) {
      String jobId = status.jobId;
      List<ChargingStationsFunction.Input> inputs = new List<ChargingStationsFunction.Input>();
      for (DeliveryWaypoint__c waypoint : waypoints) {
        ChargingStationsFunction.Input input = new ChargingStationsFunction.Input();
        input.jobId = jobId;
        input.waypointId = waypoint.id;
        inputs.add(input);
      }
      // Retrieve Charging Stations by Waypoints in Parallel
      ChargingStationsFunction.executeParallel(inputs);
    }
  }
}
