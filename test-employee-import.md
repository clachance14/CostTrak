# Testing the Enhanced Employee Import

## API Endpoint
`POST /api/employees/import`

## Query Parameters
- `mode`: 'create-only' (default) or 'update'
- `updateCraftTypes`: 'true' or 'false'

## Example Usage

### 1. Update Mode with Craft Type Updates
```
POST /api/employees/import?mode=update&updateCraftTypes=true
Form Data: file=<Employee Data.xlsx>
```

This will:
- Create new craft types found in the spreadsheet
- Deactivate craft types not in the spreadsheet
- Update existing employees' base_rate and category
- Fill in blank fields for existing employees
- Create new employees not in the database

### 2. Update Mode without Craft Type Updates
```
POST /api/employees/import?mode=update
Form Data: file=<Employee Data.xlsx>
```

This will:
- Update existing employees only
- Create new employees
- Not modify craft types

### 3. Create-Only Mode (Default)
```
POST /api/employees/import
Form Data: file=<Employee Data.xlsx>
```

This will:
- Only create new employees
- Skip existing employees
- Not modify craft types

## Expected Response

```json
{
  "success": true,
  "summary": {
    "total": 150,
    "imported": 20,
    "updated": 130,
    "skipped": 0
  },
  "errors": [],
  "craftTypes": {
    "created": 5,
    "updated": 2,
    "deactivated": 3,
    "errors": []
  }
}
```

## Fields Updated for Existing Employees
- `base_rate` - Always updated with new value
- `category` - Always updated (Direct/Indirect/Staff)
- `craft_type_id` - Updated based on craft code
- Blank fields filled: payroll_name, legal_middle_name, class, job_title_description, location_code, location_description