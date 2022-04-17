package com.salesforce.functions.demo;

import com.graphhopper.jsprit.core.algorithm.VehicleRoutingAlgorithm;
import com.graphhopper.jsprit.core.algorithm.box.Jsprit;
import com.graphhopper.jsprit.core.algorithm.selector.SelectBest;
import com.graphhopper.jsprit.core.algorithm.state.StateManager;
import com.graphhopper.jsprit.core.problem.Location;
import com.graphhopper.jsprit.core.problem.VehicleRoutingProblem;
import com.graphhopper.jsprit.core.problem.constraint.ConstraintManager;
import com.graphhopper.jsprit.core.problem.constraint.ServiceDeliveriesFirstConstraint;
import com.graphhopper.jsprit.core.problem.job.Service;
import com.graphhopper.jsprit.core.problem.solution.VehicleRoutingProblemSolution;
import com.graphhopper.jsprit.core.problem.solution.route.VehicleRoute;
import com.graphhopper.jsprit.core.problem.solution.route.activity.PickupService;
import com.graphhopper.jsprit.core.problem.solution.route.activity.TourActivity;
import com.graphhopper.jsprit.core.problem.vehicle.VehicleImpl;
import com.graphhopper.jsprit.core.problem.vehicle.VehicleImpl.Builder;
import com.graphhopper.jsprit.core.problem.vehicle.VehicleType;
import com.graphhopper.jsprit.core.problem.vehicle.VehicleTypeImpl;
import com.graphhopper.jsprit.core.reporting.SolutionPrinter;
import com.salesforce.functions.jvm.sdk.Context;
import com.salesforce.functions.jvm.sdk.InvocationEvent;
import com.salesforce.functions.jvm.sdk.SalesforceFunction;
import com.salesforce.functions.jvm.sdk.data.DataApi;
import com.salesforce.functions.jvm.sdk.data.Record;
import com.salesforce.functions.jvm.sdk.data.RecordModificationResult;
import com.salesforce.functions.jvm.sdk.data.RecordQueryResult;
import com.salesforce.functions.jvm.sdk.data.ReferenceId;
import com.salesforce.functions.jvm.sdk.data.builder.UnitOfWorkBuilder;
import com.salesforce.functions.jvm.sdk.data.error.DataApiException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Receives an account and calculates the best delivery route for different provided services */
public class RoutePlannerFunction implements SalesforceFunction<FunctionInput, FunctionOutput> {
  private static final Logger LOGGER = LoggerFactory.getLogger(RoutePlannerFunction.class);

  @Override
  public FunctionOutput apply(InvocationEvent<FunctionInput> event, Context context)
      throws Exception {

    String accountName = event.getData().getAccountName();
    DataApi dataApi = context.getOrg().get().getDataApi();

    LOGGER.info("Calculating delivery routes for Account: {}", accountName);

    // Query for Account
    List<Record> accountResults =
        dataApi
            .query(String.format("SELECT Id FROM Account WHERE Name = '%s'", accountName))
            .getRecords();

    if (accountResults.size() == 0) {
      throw new DataApiException("No account found");
    }

    // Get Account
    Record account = accountResults.get(0);

    // Build an Unit Of Work
    UnitOfWorkBuilder unitOfWork = dataApi.newUnitOfWorkBuilder();

    try {
      // Build the VRP (Vehicle Routing Problem) by querying Vehicles and Services to provide
      VehicleRoutingProblem.Builder vrpBuilder = VehicleRoutingProblem.Builder.newInstance();

      // Query Vehicles using the Data API
      RecordQueryResult vehicles =
          dataApi.query(
              "SELECT Id, Name, Location__Latitude__s, Location__Longitude__s FROM Vehicle__c");
      for (Record record : vehicles.getRecords()) {
        VehicleTypeImpl.Builder vehicleTypeBuilder =
            VehicleTypeImpl.Builder.newInstance("vehicleType").addCapacityDimension(0, 2);
        VehicleType vehicleType = vehicleTypeBuilder.build();
        String id = record.getStringField("Id").get();
        Double locationX = record.getDoubleField("Location__Latitude__s").get();
        Double locationY = record.getDoubleField("Location__Longitude__s").get();
        Builder vehicleBuilder = VehicleImpl.Builder.newInstance(id);
        vehicleBuilder.setStartLocation(Location.newInstance(locationX, locationY));
        vehicleBuilder.setType(vehicleType);
        VehicleImpl vehicle = vehicleBuilder.build();
        vrpBuilder.addVehicle(vehicle);
      }

      // Query Services using the Data API
      RecordQueryResult services =
          dataApi.query(
              String.format(
                  "SELECT Id, Name, Location__Latitude__s, Location__Longitude__s FROM Service__c"
                      + " WHERE Account__c = '%s'",
                  account.getStringField("Id").get()));
      for (Record record : services.getRecords()) {
        String id = record.getStringField("Id").get();
        Double locationX = record.getDoubleField("Location__Latitude__s").get();
        Double locationY = record.getDoubleField("Location__Longitude__s").get();
        Service service =
            Service.Builder.newInstance(id)
                .addSizeDimension(0, 1)
                .setLocation(Location.newInstance(locationX, locationY))
                .build();
        vrpBuilder.addJob(service);
      }

      VehicleRoutingProblem vrp = vrpBuilder.build();

      // Calculate the best routes for the services and vehicles
      StateManager stateManager = new StateManager(vrp);
      ConstraintManager constraintManager = new ConstraintManager(vrp, stateManager);
      constraintManager.addConstraint(
          new ServiceDeliveriesFirstConstraint(), ConstraintManager.Priority.CRITICAL);
      VehicleRoutingAlgorithm vra =
          Jsprit.Builder.newInstance(vrp)
              .setStateAndConstraintManager(stateManager, constraintManager)
              .buildAlgorithm();
      Collection<VehicleRoutingProblemSolution> solutions = vra.searchSolutions();
      VehicleRoutingProblemSolution solution = new SelectBest().selectSolution(solutions);

      // Store the delivery plan using the Unit Of Work pattern
      Record deliveryPlan =
          dataApi
              .newRecordBuilder("DeliveryPlan__c")
              .withField(
                  "Name",
                  "Delivery Plan @ "
                      + LocalDateTime.now()
                          .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS")))
              .build();
      ReferenceId deliveryPlanResult = unitOfWork.registerCreate(deliveryPlan);

      // Store the delivery routes using the Unit Of Work pattern
      for (VehicleRoute route : solution.getRoutes()) {
        Record deliveryRoute =
            dataApi
                .newRecordBuilder("DeliveryRoute__c")
                .withField("Vehicle__c", route.getVehicle().getId())
                .withField("DeliveryPlan__c", deliveryPlanResult)
                .build();
        ReferenceId deliveryRouteResult = unitOfWork.registerCreate(deliveryRoute);

        // Store the delivery waypoints using the Unit Of Work pattern
        for (TourActivity activity : route.getActivities()) {
          Record deliveryWaypoint =
              dataApi
                  .newRecordBuilder("DeliveryWaypoint__c")
                  .withField("DeliveryRoute__c", deliveryRouteResult)
                  .withField("Service__c", ((PickupService) activity).getJob().getId())
                  .withField("Number__c", activity.getIndex())
                  .build();
          unitOfWork.registerCreate(deliveryWaypoint);
        }
      }

      // Commit Unit Of Work as a single transaction
      Map<ReferenceId, RecordModificationResult> result =
          dataApi.commitUnitOfWork(unitOfWork.build());

      // Success!
      SolutionPrinter.print(vrp, solution, SolutionPrinter.Print.VERBOSE);
      return new FunctionOutput("Routes " + solution.getRoutes().size() + " calculated.", result);
    } catch (Exception e) {
      LOGGER.error("An error has ocurred", e);
      throw new RuntimeException("Error occured calculating routes", e);
    }
  }
}
