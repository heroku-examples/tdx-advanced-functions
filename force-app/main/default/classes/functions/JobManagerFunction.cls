public with sharing class JobManagerFunction {
  // Schedule a certain number of jobs and return the Job Status
  public static JobStatus execute(Integer jobs) {
    functions.Function fn = functions.Function.get(
      'tdx_advanced_functions.jobmanager'
    );
    functions.FunctionInvocation invocation = fn.invoke(
      '{ "jobs": ' +
      jobs +
      ' }'
    );

    // Check if there is any error during the invocation
    if (invocation.getStatus() == functions.FunctionInvocationStatus.ERROR) {
      String errorMessage = invocation.getError() != null
        ? invocation.getError().getMessage()
        : 'UNKNOWN';
      System.debug(errorMessage);
      throw new CalloutException(errorMessage);
    }

    String response = invocation.getResponse();
    JobStatus status = (JobStatus) JSON.deserialize(response, JobStatus.class);
    return status;
  }

  public class JobStatus {
    public String jobId;
    public String status;
  }
}
