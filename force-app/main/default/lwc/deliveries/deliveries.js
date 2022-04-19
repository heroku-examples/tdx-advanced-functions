import { LightningElement, api } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { subscribe } from "lightning/empApi";
import planDeliveryRoute from "@salesforce/apex/DeliveryRouteController.planDeliveryRoute";
import getWaypoints from "@salesforce/apex/DeliveryRouteController.getWaypoints";

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
  cdcData;
  cdcSubscription;
  jobData;
  jobSubscription;
  datatableColumns = DATATABLE_COLUMNS;
  datatableData = [];
  mapMarkers = [];

  loadWaypoints(deliveryPlanId) {
    getWaypoints({ deliveryPlanId })
      .then((data) => {
        if (data) {
          const tempDatatable = [];
          const tempMarkers = [];
          data.forEach((entry) => {
            tempDatatable.push({
              order: entry.Number__c ? entry.Number__c : 1,
              name: entry.Service__r.Name
            });
            tempMarkers.push({
              title: entry.Service__r.Name,
              location: {
                Latitude: entry.Service__r.Location__Latitude__s,
                Longitude: entry.Service__r.Location__Longitude__s
              }
            });
          });
          this.datatableData = tempDatatable.sort(this.compare);
          this.mapMarkers = tempMarkers;
        }
      })
      .catch((error) => {
        this.showError(error);
      });
  }

  connectedCallback() {
    const cdcCallback = (response) => {
      this.cdcData = response;
      const deliveryPlanId =
        response?.data?.payload?.ChangeEventHeader?.recordIds[0];
      if (deliveryPlanId) {
        console.log(
          `Route has been planned, waiting for waypoints - DeliveryPlanId: ${deliveryPlanId}`
        );
      }
    };

    const jobCompletedCallback = (response) => {
      this.jobData = response;
      const deliveryPlanId = response?.data?.payload?.DeliveryPlanId__c;
      if (deliveryPlanId) {
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

  handlePlanDeliveryRoute() {
    planDeliveryRoute({ accountId: this.recordId }).catch((error) => {
      this.showError(error);
    });
  }

  compare(sa, sb) {
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
