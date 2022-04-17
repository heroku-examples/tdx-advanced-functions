public with sharing class ChargingStationsFunction {
  public static void execute(Input input, Callback callback) {
    functions.Function fn = functions.Function.get(
      'tdx_advanced_functions.chargingstations'
    );
    fn.invoke(JSON.serialize(input), callback);
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

  public class Callback implements functions.FunctionCallback {
    protected String jobId;
    public Callback(String jobId) {
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

      // Check if this callback belongs to this job and it completed successfully
      if (this.jobId == output.job.jobId && output.job.status == 'completed') {
        System.debug('Trigger Notification');
      }
    }
  }
}
