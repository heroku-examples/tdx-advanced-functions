import { LightningElement, wire } from "lwc";
import { subscribe } from "lightning/empApi";
import getWaypoints from "@salesforce/apex/DeliveryRouteController.getWaypoints";

const CDC_CHANNEL = "/data/DeliveryPlan__ChangeEvent";

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
  accountId = undefined;
  cdcData = undefined;
  cdcSubscription = undefined;
  datatableColumns = DATATABLE_COLUMNS;
  datatableData = [];
  mapMarkers = [];

  @wire(getWaypoints, { accountId: "$accountId" })
  waypoints({ error, data }) {
    if (data) {
      const tempDatatable = [];
      const tempMarkers = [];
      data.forEach((entry) => {
        tempDatatable.push({
          order: entry.Number__c ? entry.Number__c + 1 : 1,
          name: entry.Service__r.Name
        });
        tempMarkers.push({
          title: entry.Service__r.Name,
          location: {
            Latitude: entry.Service__r.LocationX__c,
            Longitude: entry.Service__r.LocationY__c
          }
        });
      });
      this.datatableData = tempDatatable.sort(this.compare);
      // this.datatableData = tempDatatable;
      this.mapMarkers = tempMarkers;
    } else if (error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }
  }

  connectedCallback() {
    const that = this;
    const messageCallback = function (response) {
      that.cdcData = response;
      that.accountId = "something";
    };

    if (!this.cdcSubscription) {
      subscribe(CDC_CHANNEL, -1, messageCallback).then((response) => {
        // eslint-disable-next-line no-console
        console.log("Successfully subscribed");
        this.cdcSubscription = response;
      });
    }
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
}
