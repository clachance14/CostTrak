#!/bin/bash

# Test script for Purchase Orders read-only system with CSV import
# This script tests viewing and importing purchase orders

set -e

# Configuration
API_BASE="http://localhost:3000/api"
EMAIL_DOMAIN="ics.ac"
DELAY=1
TEST_DATA_DIR="./test-data"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to login and get access token
login() {
    local email=$1
    local password=$2
    
    log_info "Logging in as $email..."
    
    response=$(curl -s -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    if echo "$response" | grep -q "access_token"; then
        token=$(echo "$response" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
        echo "$token"
    else
        log_error "Failed to login: $response"
        exit 1
    fi
}

# Function to test PO list endpoint
test_po_list() {
    local token=$1
    local role=$2
    
    log_info "Testing PO list endpoint for $role..."
    
    # Test basic list
    response=$(curl -s -X GET "$API_BASE/purchase-orders" \
        -H "Authorization: Bearer $token")
    
    if echo "$response" | grep -q "purchase_orders"; then
        log_info "✓ Basic PO list successful"
        
        # Extract summary
        total_committed=$(echo "$response" | grep -o '"totalCommitted":[0-9.]*' | cut -d':' -f2)
        total_invoiced=$(echo "$response" | grep -o '"totalInvoiced":[0-9.]*' | cut -d':' -f2)
        total=$(echo "$response" | grep -o '"total":[0-9]*' | cut -d':' -f2 | head -1)
        
        log_info "  - Total POs: $total"
        log_info "  - Total Committed: \$$total_committed"
        log_info "  - Total Invoiced: \$$total_invoiced"
    else
        log_error "✗ Failed to list POs: $response"
    fi
    
    # Test with filters
    log_info "Testing PO list with filters..."
    
    # Status filter
    response=$(curl -s -X GET "$API_BASE/purchase-orders?status=approved" \
        -H "Authorization: Bearer $token")
    
    if echo "$response" | grep -q "purchase_orders"; then
        log_info "✓ Status filter working"
    else
        log_error "✗ Status filter failed"
    fi
    
    # Search filter
    response=$(curl -s -X GET "$API_BASE/purchase-orders?search=steel" \
        -H "Authorization: Bearer $token")
    
    if echo "$response" | grep -q "purchase_orders"; then
        log_info "✓ Search filter working"
    else
        log_error "✗ Search filter failed"
    fi
    
    sleep $DELAY
}

# Function to test PO detail endpoint
test_po_detail() {
    local token=$1
    local po_id=$2
    
    log_info "Testing PO detail endpoint..."
    
    response=$(curl -s -X GET "$API_BASE/purchase-orders/$po_id" \
        -H "Authorization: Bearer $token")
    
    if echo "$response" | grep -q "purchase_order"; then
        log_info "✓ PO detail retrieved successfully"
        
        # Extract PO info
        po_number=$(echo "$response" | grep -o '"po_number":"[^"]*' | cut -d'"' -f4)
        vendor=$(echo "$response" | grep -o '"vendor_name":"[^"]*' | cut -d'"' -f4)
        status=$(echo "$response" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
        
        log_info "  - PO Number: $po_number"
        log_info "  - Vendor: $vendor"
        log_info "  - Status: $status"
        
        # Check calculated fields
        if echo "$response" | grep -q "calculated"; then
            log_info "✓ Calculated fields present"
        fi
    else
        log_error "✗ Failed to get PO detail: $response"
    fi
    
    sleep $DELAY
}

# Function to test project POs endpoint
test_project_pos() {
    local token=$1
    local project_id=$2
    
    log_info "Testing project-specific PO list..."
    
    response=$(curl -s -X GET "$API_BASE/projects/$project_id/purchase-orders" \
        -H "Authorization: Bearer $token")
    
    if echo "$response" | grep -q "purchase_orders"; then
        log_info "✓ Project PO list successful"
        
        # Extract summary
        total_pos=$(echo "$response" | grep -o '"totalPOs":[0-9]*' | cut -d':' -f2)
        log_info "  - Total POs for project: $total_pos"
    else
        log_error "✗ Failed to list project POs: $response"
    fi
    
    sleep $DELAY
}

# Function to create sample CSV file
create_sample_csv() {
    local filename=$1
    
    log_info "Creating sample CSV file: $filename"
    
    cat > "$filename" << EOF
project_job_number,po_number,vendor_name,description,committed_amount,invoiced_amount,status,issue_date,expected_delivery
2024-001,PO-TEST-001,Test Vendor 1,Test materials for import,50000,25000,approved,2024-01-15,2024-02-01
2024-001,PO-TEST-002,Test Vendor 2,Additional test supplies,30000,0,draft,2024-01-20,2024-02-15
2024-002,PO-TEST-003,Test Vendor 3,Equipment rental,75000,75000,closed,2024-01-10,2024-01-25
EOF
}

# Function to test CSV import
test_csv_import() {
    local token=$1
    local role=$2
    
    log_info "Testing CSV import for $role..."
    
    # Create test directory if it doesn't exist
    mkdir -p "$TEST_DATA_DIR"
    
    # Create sample CSV
    csv_file="$TEST_DATA_DIR/test_purchase_orders.csv"
    create_sample_csv "$csv_file"
    
    # Test import
    response=$(curl -s -X POST "$API_BASE/purchase-orders/import" \
        -H "Authorization: Bearer $token" \
        -F "file=@$csv_file")
    
    if echo "$response" | grep -q "success"; then
        imported=$(echo "$response" | grep -o '"imported":[0-9]*' | cut -d':' -f2)
        updated=$(echo "$response" | grep -o '"updated":[0-9]*' | cut -d':' -f2)
        skipped=$(echo "$response" | grep -o '"skipped":[0-9]*' | cut -d':' -f2)
        
        log_info "✓ CSV import successful"
        log_info "  - Imported: $imported"
        log_info "  - Updated: $updated"
        log_info "  - Skipped: $skipped"
        
        # Check for errors
        if echo "$response" | grep -q '"errors":\[\]'; then
            log_info "✓ No import errors"
        else
            log_warning "Import completed with some errors"
        fi
    else
        if echo "$response" | grep -q "Insufficient permissions"; then
            log_warning "⚠ $role does not have import permissions (expected for some roles)"
        else
            log_error "✗ CSV import failed: $response"
        fi
    fi
    
    # Test import with project override
    if [ "$role" != "viewer" ]; then
        log_info "Testing CSV import with project override..."
        
        # Get a project ID first
        project_response=$(curl -s -X GET "$API_BASE/projects?limit=1" \
            -H "Authorization: Bearer $token")
        
        if echo "$project_response" | grep -q "projects"; then
            project_id=$(echo "$project_response" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)
            
            if [ -n "$project_id" ]; then
                response=$(curl -s -X POST "$API_BASE/purchase-orders/import" \
                    -H "Authorization: Bearer $token" \
                    -F "file=@$csv_file" \
                    -F "project_id=$project_id")
                
                if echo "$response" | grep -q "success"; then
                    log_info "✓ Import with project override successful"
                else
                    log_error "✗ Import with project override failed"
                fi
            fi
        fi
    fi
    
    # Clean up
    rm -f "$csv_file"
    
    sleep $DELAY
}

# Function to test invalid CSV import
test_invalid_csv_import() {
    local token=$1
    
    log_info "Testing CSV import error handling..."
    
    # Create invalid CSV
    invalid_csv="$TEST_DATA_DIR/invalid_purchase_orders.csv"
    cat > "$invalid_csv" << EOF
project_job_number,po_number,vendor_name,description,committed_amount,invoiced_amount,status
INVALID-JOB,PO-ERR-001,,Missing vendor name,not-a-number,0,approved
2024-001,PO-ERR-002,Test Vendor,Valid row,10000,5000,invalid-status
EOF
    
    response=$(curl -s -X POST "$API_BASE/purchase-orders/import" \
        -H "Authorization: Bearer $token" \
        -F "file=@$invalid_csv")
    
    if echo "$response" | grep -q "errors"; then
        log_info "✓ Import validation working correctly"
        
        # Check specific errors
        if echo "$response" | grep -q "vendor_name"; then
            log_info "✓ Vendor name validation working"
        fi
        
        if echo "$response" | grep -q "committed_amount"; then
            log_info "✓ Amount validation working"
        fi
    else
        log_error "✗ Import validation not working properly"
    fi
    
    # Clean up
    rm -f "$invalid_csv"
    
    sleep $DELAY
}

# Main test execution
main() {
    log_info "Starting Purchase Orders test suite..."
    
    # Test data
    users=(
        "controller@$EMAIL_DOMAIN:password123:controller"
        "accounting@$EMAIL_DOMAIN:password123:accounting"
        "ops.manager@$EMAIL_DOMAIN:password123:ops_manager"
        "pm@$EMAIL_DOMAIN:password123:project_manager"
        "viewer@$EMAIL_DOMAIN:password123:viewer"
    )
    
    for user_data in "${users[@]}"; do
        IFS=':' read -r email password role <<< "$user_data"
        
        log_info ""
        log_info "Testing as $role ($email)..."
        log_info "========================================="
        
        # Login
        token=$(login "$email" "$password")
        
        if [ -z "$token" ]; then
            log_error "Failed to get token for $email"
            continue
        fi
        
        # Run tests based on role
        case $role in
            controller|accounting|ops_manager|project_manager)
                # Full access to view POs
                test_po_list "$token" "$role"
                
                # Get a PO ID for detail test
                response=$(curl -s -X GET "$API_BASE/purchase-orders?limit=1" \
                    -H "Authorization: Bearer $token")
                
                if echo "$response" | grep -q "purchase_orders"; then
                    po_id=$(echo "$response" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)
                    if [ -n "$po_id" ]; then
                        test_po_detail "$token" "$po_id"
                    fi
                fi
                
                # Get a project ID for project PO test
                project_response=$(curl -s -X GET "$API_BASE/projects?limit=1" \
                    -H "Authorization: Bearer $token")
                
                if echo "$project_response" | grep -q "projects"; then
                    project_id=$(echo "$project_response" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)
                    if [ -n "$project_id" ]; then
                        test_project_pos "$token" "$project_id"
                    fi
                fi
                
                # Test CSV import
                test_csv_import "$token" "$role"
                
                # Test invalid CSV for roles with import permission
                if [ "$role" != "viewer" ]; then
                    test_invalid_csv_import "$token"
                fi
                ;;
                
            viewer)
                # Limited access - can only view POs for assigned projects
                test_po_list "$token" "$role"
                ;;
        esac
        
        log_info ""
    done
    
    # Clean up test data directory
    rm -rf "$TEST_DATA_DIR"
    
    log_info ""
    log_info "Purchase Orders test suite completed!"
}

# Run the tests
main