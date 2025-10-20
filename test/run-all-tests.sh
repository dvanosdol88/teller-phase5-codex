#!/bin/bash

# 

set +e  # Don't exit on error - we want to run all tests

# Configuration
BASE_URL="${BASE_URL:-https://teller-phase5-codex-1.onrender.com}"
VERBOSE="${VERBOSE:-0}"
GENERATE_HTML="${GENERATE_HTML:-0}"
OUTPUT_DIR="test/results"

for arg in "$@"; do
    case $arg in
        --verbose|-v)
            VERBOSE=1
            ;;
        --html)
            GENERATE_HTML=1
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --verbose, -v    Show detailed output"
            echo "  --html           Generate HTML report"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  BASE_URL         Base URL to test (default: https://teller-phase5-codex-1.onrender.com)"
            echo "  TELLER_TOKEN     Teller authentication token (optional)"
            echo "  VERBOSE          Set to 1 for verbose output"
            echo ""
            exit 0
            ;;
    esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
REPORT_FILE="$OUTPUT_DIR/test-report-$(date '+%Y%m%d-%H%M%S').txt"

print_header() {
    local title="$1"
    local width=80
    local padding=$(( (width - ${#title} - 2) / 2 ))
    
    echo ""
    echo -e "${BOLD}${CYAN}$(printf '=%.0s' {1..80})${NC}"
    printf "${BOLD}${CYAN}%*s${NC}" $((padding + ${#title})) "$title"
    echo ""
    echo -e "${BOLD}${CYAN}$(printf '=%.0s' {1..80})${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${BOLD}${BLUE}━━━ $1 ━━━${NC}"
    echo ""
}

{
    print_header "COMPREHENSIVE TEST REPORT"
    echo "Generated: $TIMESTAMP"
    echo "Base URL: $BASE_URL"
    echo "Teller Token: ${TELLER_TOKEN:+[PROVIDED]}${TELLER_TOKEN:-[NOT PROVIDED]}"
    echo ""
} | tee "$REPORT_FILE"

print_section "Test Suite 1: Deployment Verification" | tee -a "$REPORT_FILE"

DEPLOY_OUTPUT=$(mktemp)
if VERBOSE=$VERBOSE BASE_URL=$BASE_URL bash test/verify-deployment.sh > "$DEPLOY_OUTPUT" 2>&1; then
    DEPLOY_STATUS="✅ PASSED"
    DEPLOY_EXIT=0
else
    DEPLOY_STATUS="❌ FAILED"
    DEPLOY_EXIT=1
fi

{
    echo -e "${BOLD}Status: $DEPLOY_STATUS${NC}"
    echo ""
    cat "$DEPLOY_OUTPUT"
} | tee -a "$REPORT_FILE"

rm "$DEPLOY_OUTPUT"

print_section "Test Suite 2: API Integration Tests" | tee -a "$REPORT_FILE"

API_OUTPUT=$(mktemp)
if VERBOSE=$VERBOSE BASE_URL=$BASE_URL bash test/api-integration-test.sh > "$API_OUTPUT" 2>&1; then
    API_STATUS="✅ PASSED"
    API_EXIT=0
else
    API_STATUS="❌ FAILED"
    API_EXIT=1
fi

{
    echo -e "${BOLD}Status: $API_STATUS${NC}"
    echo ""
    cat "$API_OUTPUT"
} | tee -a "$REPORT_FILE"

rm "$API_OUTPUT"

print_section "Test Suite 3: Teller Integration Tests" | tee -a "$REPORT_FILE"

TELLER_OUTPUT=$(mktemp)
if VERBOSE=$VERBOSE BASE_URL=$BASE_URL TELLER_TOKEN=$TELLER_TOKEN bash test/teller-integration-test.sh > "$TELLER_OUTPUT" 2>&1; then
    TELLER_STATUS="✅ PASSED"
    TELLER_EXIT=0
else
    TELLER_STATUS="❌ FAILED"
    TELLER_EXIT=1
fi

{
    echo -e "${BOLD}Status: $TELLER_STATUS${NC}"
    echo ""
    cat "$TELLER_OUTPUT"
} | tee -a "$REPORT_FILE"

rm "$TELLER_OUTPUT"

print_header "OVERALL SUMMARY" | tee -a "$REPORT_FILE"

{
    echo "Test Suite Results:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    printf "%-40s %s\n" "1. Deployment Verification" "$DEPLOY_STATUS"
    printf "%-40s %s\n" "2. API Integration Tests" "$API_STATUS"
    printf "%-40s %s\n" "3. Teller Integration Tests" "$TELLER_STATUS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    TOTAL_SUITES=3
    PASSED_SUITES=$(( (DEPLOY_EXIT == 0) + (API_EXIT == 0) + (TELLER_EXIT == 0) ))
    FAILED_SUITES=$(( TOTAL_SUITES - PASSED_SUITES ))
    
    if [ "$PASSED_SUITES" -eq "$TOTAL_SUITES" ]; then
        echo -e "${GREEN}${BOLD}✓ ALL TEST SUITES PASSED ($PASSED_SUITES/$TOTAL_SUITES)${NC}"
        OVERALL_STATUS="PASS"
    else
        echo -e "${RED}${BOLD}✗ SOME TEST SUITES FAILED ($FAILED_SUITES/$TOTAL_SUITES failed)${NC}"
        OVERALL_STATUS="FAIL"
    fi
    echo ""
} | tee -a "$REPORT_FILE"

print_section "Key Findings" | tee -a "$REPORT_FILE"

{
    echo "Based on test results, here are the key findings:"
    echo ""
    
    if [ "$DEPLOY_EXIT" -eq 0 ]; then
        echo "✅ Deployment: Service is deployed and responding correctly"
    else
        echo "❌ Deployment: Service has deployment issues"
        echo "   → Check that latest code is deployed"
        echo "   → Verify environment variables are set"
    fi
    echo ""
    
    if [ "$API_EXIT" -eq 0 ]; then
        echo "✅ API Integration: All manual data endpoints working"
    else
        echo "❌ API Integration: Some endpoints failing"
        echo "   → Check database connectivity"
        echo "   → Verify FEATURE_MANUAL_DATA is enabled"
    fi
    echo ""
    
    if [ "$TELLER_EXIT" -eq 0 ]; then
        echo "✅ Teller Integration: Live data fetching is working"
    else
        echo "❌ Teller Integration: Issues with live data"
        echo "   → Check if FEATURE_STATIC_DB is disabled"
        echo "   → Verify data timestamps are recent (not Oct 18)"
        echo "   → Confirm user has enrolled accounts via Teller Connect"
    fi
    echo ""
} | tee -a "$REPORT_FILE"

print_section "Recommendations" | tee -a "$REPORT_FILE"

{
    if [ "$OVERALL_STATUS" = "PASS" ]; then
        echo "🎉 All tests passed! The system is working correctly."
        echo ""
        echo "Next steps:"
        echo "  • Monitor production for any issues"
        echo "  • Consider adding more test coverage"
        echo "  • Document any manual testing procedures"
    else
        echo "⚠️  Some tests failed. Here's what to do:"
        echo ""
        
        if [ "$DEPLOY_EXIT" -ne 0 ]; then
            echo "1. Fix Deployment Issues:"
            echo "   • Redeploy with latest code from main branch"
            echo "   • Verify render.yaml configuration"
            echo "   • Check service logs for startup errors"
            echo ""
        fi
        
        if [ "$API_EXIT" -ne 0 ]; then
            echo "2. Fix API Integration Issues:"
            echo "   • Verify DATABASE_URL is set and accessible"
            echo "   • Check FEATURE_MANUAL_DATA=true in environment"
            echo "   • Review server logs for database errors"
            echo ""
        fi
        
        if [ "$TELLER_EXIT" -ne 0 ]; then
            echo "3. Fix Teller Integration Issues:"
            echo "   • Set FEATURE_STATIC_DB=false (or remove it)"
            echo "   • Verify local /api/db/* routes are NOT registered"
            echo "   • Check that proxy forwards to backend correctly"
            echo "   • Ensure user has enrolled via Teller Connect"
            echo ""
        fi
        
        echo "After making changes:"
        echo "  • Redeploy the service"
        echo "  • Run this test suite again: ./test/run-all-tests.sh"
        echo "  • Verify all tests pass before considering it fixed"
    fi
    echo ""
} | tee -a "$REPORT_FILE"

print_section "Report Saved" | tee -a "$REPORT_FILE"

{
    echo "Full report saved to: $REPORT_FILE"
    echo ""
    echo "To view the report:"
    echo "  cat $REPORT_FILE"
    echo ""
    
    if [ "$GENERATE_HTML" -eq 1 ]; then
        HTML_FILE="${REPORT_FILE%.txt}.html"
        echo "Generating HTML report..."
        
        {
            echo "<!DOCTYPE html>"
            echo "<html><head><title>Test Report - $TIMESTAMP</title>"
            echo "<style>"
            echo "body { font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px; }"
            echo "pre { background: #2d2d2d; padding: 15px; border-radius: 5px; overflow-x: auto; }"
            echo ".pass { color: #4ec9b0; }"
            echo ".fail { color: #f48771; }"
            echo ".warn { color: #dcdcaa; }"
            echo "</style>"
            echo "</head><body>"
            echo "<pre>"
            cat "$REPORT_FILE" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g'
            echo "</pre>"
            echo "</body></html>"
        } > "$HTML_FILE"
        
        echo "HTML report saved to: $HTML_FILE"
        echo ""
    fi
} | tee -a "$REPORT_FILE"

if [ "$OVERALL_STATUS" = "PASS" ]; then
    exit 0
else
    exit 1
fi
