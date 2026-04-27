public with sharing class RecordSummaryController {

    public class MetricResult {
        @AuraEnabled public Integer openActivities;
        @AuraEnabled public Integer overdueActivities;
        @AuraEnabled public Integer completedActivities;
        @AuraEnabled public Integer notes;
        @AuraEnabled public Integer files;
        @AuraEnabled public Datetime openDate;
        @AuraEnabled public Datetime closeDate;
    }

    @AuraEnabled(cacheable=true)
    public static MetricResult getRecordMetrics(
        Id recordId,
        String objectApiName,
        String openDateField,
        String closeDateField
    ) {
        if (recordId == null) {
            throw new AuraHandledException('recordId is required');
        }

        MetricResult result = new MetricResult();
        Date today = Date.today();

        // Open tasks (ActivityDate in future or null, Status != Completed/Deferred)
        result.openActivities = [
            SELECT COUNT()
            FROM Task
            WHERE WhatId = :recordId
            AND IsClosed = false
            WITH SECURITY_ENFORCED
        ];

        // Overdue open tasks
        result.overdueActivities = [
            SELECT COUNT()
            FROM Task
            WHERE WhatId = :recordId
            AND IsClosed = false
            AND ActivityDate < :today
            WITH SECURITY_ENFORCED
        ];

        // Completed tasks
        Integer completedTasks = [
            SELECT COUNT()
            FROM Task
            WHERE WhatId = :recordId
            AND IsClosed = true
            WITH SECURITY_ENFORCED
        ];

        // Past events (ended before now)
        Integer pastEvents = [
            SELECT COUNT()
            FROM Event
            WHERE WhatId = :recordId
            AND EndDateTime <= :Datetime.now()
            WITH SECURITY_ENFORCED
        ];

        result.completedActivities = completedTasks + pastEvents;

        // Notes (ContentNote linked via ContentDocumentLink)
        result.notes = [
            SELECT COUNT()
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :recordId
            AND ContentDocument.FileType = 'SNOTE'
            WITH SECURITY_ENFORCED
        ];

        // Files (all ContentDocuments minus notes)
        result.files = [
            SELECT COUNT()
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :recordId
            AND ContentDocument.FileType != 'SNOTE'
            WITH SECURITY_ENFORCED
        ];

        // Duration fields — only query when admin has configured field names
        if (String.isNotBlank(openDateField) && String.isNotBlank(objectApiName)) {
            result.openDate = queryDurationField(recordId, objectApiName, openDateField);
        }
        if (String.isNotBlank(closeDateField) && String.isNotBlank(objectApiName)) {
            result.closeDate = queryDurationField(recordId, objectApiName, closeDateField);
        }

        return result;
    }

    // Validates the field name exists on the object before issuing dynamic SOQL,
    // preventing SOQL injection and giving a clean error for typos.
    private static Datetime queryDurationField(Id recordId, String objectApiName, String fieldName) {
        Schema.SObjectType objType = Schema.getGlobalDescribe().get(objectApiName);
        if (objType == null) {
            throw new AuraHandledException('Unknown object: ' + objectApiName);
        }

        Map<String, Schema.SObjectField> fields = objType.getDescribe().fields.getMap();
        String fieldKey = fieldName.toLowerCase();
        if (!fields.containsKey(fieldKey)) {
            throw new AuraHandledException('Field not found on ' + objectApiName + ': ' + fieldName);
        }

        Schema.DisplayType fieldType = fields.get(fieldKey).getDescribe().getType();
        Boolean isDateOrDatetime = (fieldType == Schema.DisplayType.DATE || fieldType == Schema.DisplayType.DATETIME);
        if (!isDateOrDatetime) {
            throw new AuraHandledException('Field ' + fieldName + ' must be a Date or DateTime type');
        }

        String soql = 'SELECT ' + String.escapeSingleQuotes(fieldName) +
                      ' FROM ' + String.escapeSingleQuotes(objectApiName) +
                      ' WHERE Id = :recordId WITH SECURITY_ENFORCED LIMIT 1';
        List<SObject> rows = Database.query(soql);
        if (rows.isEmpty()) return null;

        Object raw = rows[0].get(fieldName);
        if (raw == null) return null;
        if (raw instanceof Datetime) return (Datetime) raw;
        // Date fields — convert to Datetime at midnight UTC
        return Datetime.newInstance(((Date) raw).year(), ((Date) raw).month(), ((Date) raw).day());
    }
}
