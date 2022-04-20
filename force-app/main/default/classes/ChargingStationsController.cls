public with sharing class ChargingStationsController {
  public static void execute(List<DeliveryWaypoint__c> waypoints) {
    // Schedule Job
    Integer jobs = waypoints.size();
    JobManagerFunction.execute(jobs, new Callback(waypoints));
  }

  // Job Manager Callback
  private class Callback extends JobManagerFunction.Callback {
    protected List<DeliveryWaypoint__c> waypoints;
    public Callback(List<DeliveryWaypoint__c> waypoints) {
      this.waypoints = waypoints;
    }

    public override void handleJobStatus(JobManagerFunction.JobStatus status) {
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
}
