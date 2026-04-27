public with sharing class ExRecordListController {

    public class RecordRow {
        @AuraEnabled public Id recordId;
        @AuraEnabled public String name;
        @AuraEnabled public Map<String, String> fields;   // fieldApiName → display value
        @AuraEnabled public String statusValue;
        @AuraEnabled public String priorityValue;
        @AuraEnabled public String statusPillClass;
        @AuraEnabled public String priorityPillClass;
        @AuraEnabled public Long lastModifiedMs;
    }

    public class StatCard {
        @AuraEnabled public String label;
        @AuraEnabled public Integer count;
        @AuraEnabled public String filterValue;   // matches a tab filterValue
    }

    public class ListResult {
        @AuraEnabled public List<RecordRow> rows;
        @AuraEnabled public List<StatCard> stats;
        @AuraEnabled public Integer totalCount;
    }

    // Pill colour map: keys are lower-cased field values
    // Format:  value → 'bg-hex|fg-hex'  (admins can't customise at runtime; themes come from meta)
    private static final Map<String, String> STATUS_PALETTE = new Map<String, String>{
        'new'           => 'pill--blue',
        'open'          => 'pill--blue',
        'working'       => 'pill--indigo',
        'in progress'   => 'pill--indigo',
        'pending'       => 'pill--orange',
        'pending receipt' => 'pill--purple',
        'waiting'       => 'pill--orange',
        'on hold'       => 'pill--orange',
        'escalated'     => 'pill--red',
        'closed'        => 'pill--green',
        'resolved'      => 'pill--green',
        'completed'     => 'pill--green',
        'fulfilled'     => 'pill--green',
        'approved'      => 'pill--green',
        'paid'          => 'pill--green',
        'rejected'      => 'pill--red',
        'cancelled'     => 'pill--red',
        'denied'        => 'pill--red',
        'unfulfilled'   => 'pill--orange',
        'authorized'    => 'pill--orange',
        'draft'         => 'pill--grey',
        'inactive'      => 'pill--grey'
    };

    private static final Map<String, String> PRIORITY_PALETTE = new Map<String, String>{
        'low'      => 'pill--green',
        'normal'   => 'pill--blue',
        'medium'   => 'pill--blue',
        'high'     => 'pill--orange',
        'critical' => 'pill--red',
        'urgent'   => 'pill--red'
    };

    @AuraEnabled(cacheable=true)
    public static ListResult getRecords(
        String objectApiName,
        String displayFields,        // comma-separated: 'CaseNumber,Subject,AccountId'
        String statusField,          // e.g. 'Status'
        String priorityField,        // e.g. 'Priority'  (optional)
        String filterField,          // field used for tab filtering, e.g. 'Status'
        String filterValue,          // selected tab value, '' = all
        String searchTerm,           // search box input
        String nameField,            // field to use as the record title link, e.g. 'Subject'
        Integer pageSize,
        Integer pageOffset
    ) {
        if (String.isBlank(objectApiName)) {
            throw new AuraHandledException('objectApiName is required');
        }

        Integer safeSize   = (pageSize   != null && pageSize   > 0 && pageSize   <= 200) ? pageSize   : 20;
        Integer safeOffset = (pageOffset != null && pageOffset >= 0)                     ? pageOffset : 0;

        Schema.SObjectType objType = Schema.getGlobalDescribe().get(objectApiName);
        if (objType == null) throw new AuraHandledException('Unknown object: ' + objectApiName);
        Map<String, Schema.SObjectField> allFields = objType.getDescribe().fields.getMap();

        // Parse + validate requested display fields
        List<String> requestedFields = parseFieldList(displayFields);
        List<String> safeFields = new List<String>{ 'Id', 'LastModifiedDate' };
        Set<String> addedLower = new Set<String>{ 'id', 'lastmodifieddate' };

        for (String f : requestedFields) {
            String fLow = f.toLowerCase();
            if (!addedLower.contains(fLow) && allFields.containsKey(fLow)) {
                safeFields.add(f);
                addedLower.add(fLow);
            }
        }

        // Add status/priority fields if not already included
        for (String f : new List<String>{ statusField, priorityField, filterField, nameField }) {
            if (String.isNotBlank(f)) {
                String fLow = f.toLowerCase();
                if (!addedLower.contains(fLow) && allFields.containsKey(fLow)) {
                    safeFields.add(f);
                    addedLower.add(fLow);
                }
            }
        }

        String fieldClause = String.join(safeFields, ', ');
        // Resolve the search field — must exist on the object
        String searchField = 'Id'; // fallback: effectively no text search
        if (String.isNotBlank(nameField) && allFields.containsKey(nameField.toLowerCase())) {
            searchField = nameField;
        } else if (allFields.containsKey('name')) {
            searchField = 'Name';
        }
        String whereClause = buildWhereClause(filterField, filterValue, searchTerm, searchField, allFields);
        String countSoql   = 'SELECT COUNT() FROM ' + String.escapeSingleQuotes(objectApiName) + whereClause + ' WITH SECURITY_ENFORCED';
        String dataSoql    = 'SELECT ' + fieldClause + ' FROM ' + String.escapeSingleQuotes(objectApiName)
                           + whereClause + ' WITH SECURITY_ENFORCED ORDER BY LastModifiedDate DESC NULLS LAST LIMIT :safeSize OFFSET :safeOffset';

        ListResult result  = new ListResult();
        result.totalCount  = Database.countQuery(countSoql);
        result.rows        = new List<RecordRow>();

        List<SObject> records = Database.query(dataSoql);
        // Use nameField if it exists on the object, otherwise fall back to 'Name' if present, else use Id
        String resolvedNameField = 'Id';
        if (String.isNotBlank(nameField) && allFields.containsKey(nameField.toLowerCase())) {
            resolvedNameField = nameField;
        } else if (allFields.containsKey('name')) {
            resolvedNameField = 'Name';
        }

        for (SObject rec : records) {
            RecordRow row    = new RecordRow();
            row.recordId     = (Id) rec.get('Id');
            Object nameVal   = safeGet(rec, resolvedNameField, allFields);
            row.name         = nameVal != null ? String.valueOf(nameVal) : String.valueOf(row.recordId);
            row.fields       = new Map<String, String>();
            row.lastModifiedMs = ((Datetime) rec.get('LastModifiedDate')).getTime();

            for (String f : requestedFields) {
                if (allFields.containsKey(f.toLowerCase())) {
                    Object val = safeGet(rec, f, allFields);
                    row.fields.put(f, val != null ? String.valueOf(val) : '');
                }
            }

            if (String.isNotBlank(statusField) && allFields.containsKey(statusField.toLowerCase())) {
                Object val = safeGet(rec, statusField, allFields);
                row.statusValue    = val != null ? String.valueOf(val) : '';
                row.statusPillClass = resolvePill(row.statusValue, STATUS_PALETTE);
            }

            if (String.isNotBlank(priorityField) && allFields.containsKey(priorityField.toLowerCase())) {
                Object val = safeGet(rec, priorityField, allFields);
                row.priorityValue    = val != null ? String.valueOf(val) : '';
                row.priorityPillClass = resolvePill(row.priorityValue, PRIORITY_PALETTE);
            }

            result.rows.add(row);
        }

        // Build stat cards from distinct filterField values
        result.stats = buildStatCards(objectApiName, filterField, whereClause, allFields);
        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String buildWhereClause(
        String filterField, String filterValue,
        String searchTerm,
        String searchField,
        Map<String, Schema.SObjectField> allFields
    ) {
        List<String> conditions = new List<String>();

        if (String.isNotBlank(filterField) && String.isNotBlank(filterValue) && filterValue != 'all') {
            String escapedVal = String.escapeSingleQuotes(filterValue);
            String escapedFld = String.escapeSingleQuotes(filterField);
            conditions.add(escapedFld + ' = \'' + escapedVal + '\'');
        }

        if (String.isNotBlank(searchTerm) && searchTerm.length() >= 2
                && String.isNotBlank(searchField) && searchField != 'Id'
                && allFields.containsKey(searchField.toLowerCase())) {
            String escaped = '%' + String.escapeSingleQuotes(searchTerm.trim()) + '%';
            conditions.add(String.escapeSingleQuotes(searchField) + ' LIKE \'' + escaped + '\'');
        }

        return conditions.isEmpty() ? '' : ' WHERE ' + String.join(conditions, ' AND ');
    }

    private static List<StatCard> buildStatCards(
        String objectApiName, String filterField,
        String baseWhere,
        Map<String, Schema.SObjectField> allFields
    ) {
        List<StatCard> cards = new List<StatCard>();
        if (String.isBlank(filterField) || !allFields.containsKey(filterField.toLowerCase())) return cards;

        // Total "all" card
        StatCard allCard = new StatCard();
        allCard.label = 'All Records';
        allCard.filterValue = 'all';
        String allCountSoql = 'SELECT COUNT() FROM ' + String.escapeSingleQuotes(objectApiName) + ' WITH SECURITY_ENFORCED';
        allCard.count = Database.countQuery(allCountSoql);
        cards.add(allCard);

        // Per-value cards from AggregateResult
        String aggSoql = 'SELECT ' + String.escapeSingleQuotes(filterField) + ' fval, COUNT(Id) cnt'
                       + ' FROM ' + String.escapeSingleQuotes(objectApiName)
                       + ' WITH SECURITY_ENFORCED'
                       + ' GROUP BY ' + String.escapeSingleQuotes(filterField)
                       + ' ORDER BY COUNT(Id) DESC LIMIT 6';

        for (AggregateResult ar : Database.query(aggSoql)) {
            Object fval = ar.get('fval');
            if (fval == null) continue;
            StatCard card = new StatCard();
            card.label = String.valueOf(fval);
            card.count = (Integer) ar.get('cnt');
            card.filterValue = String.valueOf(fval);
            cards.add(card);
        }
        return cards;
    }

    private static List<String> parseFieldList(String csv) {
        List<String> result = new List<String>();
        if (String.isBlank(csv)) return result;
        for (String s : csv.split(',')) {
            String trimmed = s.trim();
            if (String.isNotBlank(trimmed)) result.add(trimmed);
        }
        return result;
    }

    private static Object safeGet(SObject rec, String fieldName, Map<String, Schema.SObjectField> allFields) {
        try { return rec.get(fieldName); } catch (Exception e) { return null; }
    }

    private static String resolvePill(String value, Map<String, String> palette) {
        if (String.isBlank(value)) return 'pill--grey';
        String key = value.toLowerCase().trim();
        return palette.containsKey(key) ? palette.get(key) : 'pill--grey';
    }
}
