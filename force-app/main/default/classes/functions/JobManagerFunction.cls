public with sharing class JobManagerFunction {
  // Schedule a certain number of jobs and return the Job Status
  public static void execute(Integer jobs, Callback callback) {
    functions.Function fn = functions.Function.get(
      'tdx_advanced_functions.jobmanager'
    );
    functions.FunctionInvocation invocation = fn.invoke(
      '{ "jobs": ' +
      jobs +
      ' }',
      callback
    );
  }

  public class JobStatus {
    public String jobId;
    public String status;
  }

  public virtual class Callback implements functions.FunctionCallback {
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
      JobStatus status = (JobStatus) JSON.deserialize(
        response,
        JobStatus.class
      );
      handleJobStatus(status);
    }

    public virtual void handleJobStatus(JobStatus status) {
      System.debug('Job ' + status.jobId + ' is ' + status.status);
    }
  }
}
