import { LightningElement, api } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { subscribe } from "lightning/empApi";
import planDeliveryRoute from "@salesforce/apex/DeliveryRouteController.planDeliveryRoute";
import getWaypoints from "@salesforce/apex/DeliveryRouteController.getWaypoints";
import getChargingStations from "@salesforce/apex/DeliveryRouteController.getChargingStations";

const CDC_CHANNEL = "/data/DeliveryPlan__ChangeEvent";
const JOB_CHANNEL = "/event/JobCompleted__e";

const DATATABLE_COLUMNS = [
  {
    label: "Delivery Order",
    fieldName: "order",
    type: "number",
    cellAttributes: { alignment: "left" }
  },
  { label: "Name", fieldName: "name" }
];

export default class Deliveries extends LightningElement {
  @api recordId;
  error;
  planningRoute = false;
  progress = 0;
  progressText = "";
  cdcData;
  cdcSubscription;
  jobData;
  jobSubscription;
  datatableColumns = DATATABLE_COLUMNS;
  datatableData = [];
  mapMarkers = [];
  centerLocation;

  connectedCallback() {
    const cdcCallback = (response) => {
      this.cdcData = response;
      const deliveryPlanId =
        response?.data?.payload?.ChangeEventHeader?.recordIds[0];
      if (deliveryPlanId) {
        console.log(
          `Route has been planned, waiting for charging stations - DeliveryPlanId: ${deliveryPlanId}`
        );
        this.progress = 50;
        this.progressText =
          "Route has been planned, waiting for charging stations...";
      }
    };

    const jobCompletedCallback = (response) => {
      this.jobData = response;
      const deliveryPlanId = response?.data?.payload?.DeliveryPlan_Id__c;
      console.log(`Job has completed - DeliveryPlanId: ${deliveryPlanId}`);
      if (deliveryPlanId) {
        this.progress = 75;
        this.progressText = "Job has completed, rendering delivery waypoints!";
        this.loadWaypoints(deliveryPlanId);
      }
    };

    if (!this.cdcSubscription) {
      subscribe(CDC_CHANNEL, -1, cdcCallback).then((response) => {
        // eslint-disable-next-line no-console
        console.log("Successfully subscribed to CDC");
        this.cdcSubscription = response;
      });
    }

    if (!this.jobSubscription) {
      subscribe(JOB_CHANNEL, -1, jobCompletedCallback).then((response) => {
        // eslint-disable-next-line no-console
        console.log("Successfully subscribed to Job Event");
        this.jobSubscription = response;
      });
    }
  }

  loadWaypoints(deliveryPlanId) {
    const tempDatatable = [];
    const tempMarkers = [];
    Promise.all([
      getWaypoints({ deliveryPlanId }),
      getChargingStations({ deliveryPlanId })
    ])
      .then(([waypointsData, chargingStationsData]) => {
        this.progress = 100;
        // Extract Waypoints Data
        if (waypointsData) {
          waypointsData.forEach((entry) => {
            const order = entry.Number__c ? entry.Number__c : 1;
            tempDatatable.push({
              order,
              name: entry.Service__r.Name
            });
            tempMarkers.push({
              title: `${order} - ${entry.Service__r.Name}`,
              value: "delivery" + entry.Number__c ? entry.Number__c : 1,
              location: {
                Latitude: entry.Service__r.Location__Latitude__s,
                Longitude: entry.Service__r.Location__Longitude__s
              }
            });
          });
        }

        // Extract Charging Stations Data
        if (chargingStationsData) {
          chargingStationsData.forEach((entry, index) => {
            tempMarkers.push({
              title: entry.Name,
              value: "station" + index,
              description: `<p>${entry.Street_Address__c}</p><p>${entry.City__c}, ${entry.State__c}, ${entry.Zip__c}</p>`,
              location: {
                Latitude: entry.Location__Latitude__s,
                Longitude: entry.Location__Longitude__s
              },
              mapIcon: {
                path: "M 2,1 C 0.8344723,1 0,1.7955215 0,3 L 0,14 7,14 7,6.125 C 7,6.125 7.875,6 7.875,7 l 0,4 c 0,2 1.864698,2.125 2.125,2.125 0.275652,0 2.125,-0.124975 2.125,-2.125 l 0,-4 c 0,0 1.387558,0.017377 1.375,-2.96875 l -0.75,0 0,-2 C 12.75,1.4640917 12,1.4675079 12,2 l 0,2 -1,0 0,-2 C 11,1.4538157 10.25,1.4548128 10.25,2 l 0,2 -0.75,0 c 0.012522,2.9863904 1.375,3 1.375,3 l 0,4 c 0,0.874159 -0.767136,0.875 -0.875,0.875 -0.107864,0 -0.875,-0.04279 -0.875,-0.875 l 0,-4 C 9.125,5.7190916 8,4.875 7,4.875 L 7,3 C 7,1.7775442 6.1835046,1 5,1 z M 3,4 5,4 3.75,6 5.25,6 2.5,10 2,10 3,7 1.75,7 z",
                fillColor: "purple",
                fillOpacity: 0.9,
                strokeWeight: 0.5,
                scale: 2,
                anchor: { x: 14, y: 14 }
              }
            });
          });
        }
        console.log(tempMarkers);
        this.datatableData = tempDatatable.sort(this.sortDataTable);
        this.mapMarkers = tempMarkers.sort(this.sortMapMarkers);
        if (this.mapMarkers.length > 0) {
          this.centerLocation = this.mapMarkers[0].location;
        }
        this.planningRoute = false;
      })
      .catch((error) => {
        this.showError(error);
      });
  }

  handlePlanDeliveryRoute() {
    this.mapMarkers = [];
    this.datatableData = [];
    this.planningRoute = true;
    this.progress = 0;
    this.progressText = "Calculating delivery route...";
    planDeliveryRoute({ accountId: this.recordId }).catch((error) => {
      this.showError(error);
    });
  }

  sortMapMarkers(la, lb) {
    const locationA = la.value;
    const locationB = lb.value;
    let comparison = 0;
    if (locationA > locationB) {
      comparison = 1;
    } else if (locationA < locationB) {
      comparison = -1;
    }
    return comparison;
  }

  sortDataTable(sa, sb) {
    const serviceA = sa.order;
    const serviceB = sb.order;

    let comparison = 0;
    if (serviceA > serviceB) {
      comparison = 1;
    } else if (serviceA < serviceB) {
      comparison = -1;
    }
    return comparison;
  }

  showError(error) {
    this.error = error;
    this.planningRoute = false;
    this.mapMarkers = [];
    this.datatableData = [];
    this.showToast(
      "An error has occurred",
      error?.message || error?.body?.message,
      "error"
    );
  }

  showToast(title, message, variant) {
    const event = new ShowToastEvent({
      title,
      message,
      variant
    });
    this.dispatchEvent(event);
  }
}
