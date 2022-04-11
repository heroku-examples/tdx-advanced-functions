public with sharing class Demo {

    public static void execute() {
        MyCallback callback = new MyCallback(2);
        ChargingStationsFunction.invoke('{}', callback);
        ChargingStationsFunction.invoke('{}', callback);
    }

    public class MyCallback implements functions.FunctionCallback {
        Integer times;

        public MyCallback(Integer times) {
            this.times = times;
        }

        public void handleResponse(functions.FunctionInvocation invocation) {
            times++;
            if (times == 2) {
                System.debug('It executed twice');
            }
            System.debug('It executed ' + times + ' times');
        }
    }
}
