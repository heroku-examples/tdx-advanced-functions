trigger DeliveryPlanTrigger on DeliveryPlan__ChangeEvent(after insert) {
  new DeliveryPlanTriggerHandler(Trigger.New);
}
