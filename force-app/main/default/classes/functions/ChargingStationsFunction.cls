public with sharing class ChargingStationsFunction {
  public static void executeAsync(
    Input input,
    functions.FunctionCallback callback
  ) {
    functions.Function fn = functions.Function.get(
      'tdx_advanced_functions.chargingstations'
    );
    fn.invoke(JSON.serialize(input), callback);
  }

  public static void executeParallel(List<Input> inputs) {
    for (Input input : inputs) {
      ChargingStationsFunction.executeAsync(
        input,
        new JobCallback(input.jobId)
      );
    }
  }

  public class Input {
    public Id waypointId;
    public String jobId;
  }

  public class Output {
    public Id deliveryPlanId;
    public Id waypointId;
    public JobManagerFunction.JobStatus job;
  }

  private class JobCallback implements functions.FunctionCallback {
    protected String jobId;
    public JobCallback(String jobId) {
      this.jobId = jobId;
    }

    public void handleResponse(functions.FunctionInvocation invocation) {
      // Check if there is any error during the invocation
      if (invocation.getStatus() == functions.FunctionInvocationStatus.ERROR) {
        String errorMessage = invocation.getError() != null
          ? invocation.getError().getMessage()
          : 'UNKNOWN';
        System.debug(errorMessage);
        throw new CalloutException(errorMessage);
      }

      String response = invocation.getResponse();
      Output output = (Output) JSON.deserialize(response, Output.class);

      // Check if this callback was executed in a Job context and it completed successfully
      if (
        output.job != null &&
        (this.jobId == output.job.jobId &&
        output.job.status == 'completed')
      ) {
        System.debug('Trigger Custom Notification');
      }
    }
  }
}
