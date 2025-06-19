#!/bin/bash

# Setup script for HuggingFace endpoint cost control cron jobs

set -e

echo "=== HuggingFace Endpoint Cost Control Setup ==="
echo ""

# Check if running as root for cron setup
if [ "$EUID" -eq 0 ]; then 
   echo "Note: Running as root. Cron jobs will be installed system-wide."
else
   echo "Note: Running as user. Cron jobs will be installed for current user."
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Check if scheduler script exists
SCHEDULER_SCRIPT="$SCRIPT_DIR/hf-endpoint-scheduler.py"
if [ ! -f "$SCHEDULER_SCRIPT" ]; then
    echo "Error: Scheduler script not found at $SCHEDULER_SCRIPT"
    exit 1
fi

# Make scheduler executable
chmod +x "$SCHEDULER_SCRIPT"

# Create log directory
LOG_DIR="/var/log"
if [ ! -w "$LOG_DIR" ]; then
    LOG_DIR="$HOME/.hf-scheduler"
    mkdir -p "$LOG_DIR"
    echo "Using user log directory: $LOG_DIR"
fi

# Create cron entries
CRON_ENTRIES="# HuggingFace Endpoint Scheduler - Auto-generated
# Check and apply schedule every 15 minutes
*/15 * * * * HF_TOKEN=\$(grep '^HF_TOKEN=' $PROJECT_DIR/.env.local | cut -d'=' -f2-) /usr/bin/python3 $SCHEDULER_SCRIPT --action apply >> $LOG_DIR/hf-scheduler.log 2>&1

# Force pause all endpoints at 10 PM UTC daily (cost control)
0 22 * * * HF_TOKEN=\$(grep '^HF_TOKEN=' $PROJECT_DIR/.env.local | cut -d'=' -f2-) /usr/bin/python3 $SCRIPT_DIR/manage-hf-endpoints.py pause --name hunyuan-fast >> $LOG_DIR/hf-scheduler.log 2>&1

# Resume fast endpoint at 8 AM UTC on weekdays
0 8 * * 1-5 HF_TOKEN=\$(grep '^HF_TOKEN=' $PROJECT_DIR/.env.local | cut -d'=' -f2-) /usr/bin/python3 $SCRIPT_DIR/manage-hf-endpoints.py resume --name hunyuan-fast >> $LOG_DIR/hf-scheduler.log 2>&1

# Scale down to 0 replicas on weekends
0 0 * * 6 HF_TOKEN=\$(grep '^HF_TOKEN=' $PROJECT_DIR/.env.local | cut -d'=' -f2-) /usr/bin/python3 $SCRIPT_DIR/manage-hf-endpoints.py scale --name hunyuan-fast --min-replicas 0 --max-replicas 1 >> $LOG_DIR/hf-scheduler.log 2>&1

# Health check every hour during work hours
0 9-21 * * * HF_TOKEN=\$(grep '^HF_TOKEN=' $PROJECT_DIR/.env.local | cut -d'=' -f2-) /usr/bin/python3 $SCRIPT_DIR/manage-hf-endpoints.py health --url \$(grep '^HF_ENDPOINT_FAST_URL=' $PROJECT_DIR/.env.local | cut -d'=' -f2-) >> $LOG_DIR/hf-scheduler.log 2>&1
"

# Backup existing crontab
echo "Backing up existing crontab..."
crontab -l > /tmp/crontab.backup 2>/dev/null || true

# Check if cron entries already exist
if crontab -l 2>/dev/null | grep -q "HuggingFace Endpoint Scheduler"; then
    echo "HuggingFace cron jobs already installed."
    echo ""
    echo "Current cron jobs:"
    crontab -l | grep -A 10 "HuggingFace Endpoint Scheduler"
    echo ""
    read -p "Do you want to update them? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing cron jobs."
        exit 0
    fi
    # Remove existing entries
    crontab -l | grep -v "HuggingFace Endpoint Scheduler" | grep -v "hf-endpoint-scheduler.py" | grep -v "manage-hf-endpoints.py.*hunyuan" > /tmp/crontab.new || true
else
    crontab -l > /tmp/crontab.new 2>/dev/null || true
fi

# Add new entries
echo "$CRON_ENTRIES" >> /tmp/crontab.new

# Install new crontab
crontab /tmp/crontab.new
echo "✅ Cron jobs installed successfully!"

# Create systemd timer as alternative (for systems using systemd)
if command -v systemctl &> /dev/null; then
    echo ""
    echo "Creating systemd timer as alternative..."
    
    # Create service file
    sudo tee /etc/systemd/system/hf-endpoint-scheduler.service > /dev/null <<EOF
[Unit]
Description=HuggingFace Endpoint Scheduler
After=network.target

[Service]
Type=oneshot
EnvironmentFile=$PROJECT_DIR/.env.local
ExecStart=/usr/bin/python3 $SCHEDULER_SCRIPT --action apply
StandardOutput=journal
StandardError=journal
EOF

    # Create timer file
    sudo tee /etc/systemd/system/hf-endpoint-scheduler.timer > /dev/null <<EOF
[Unit]
Description=Run HuggingFace Endpoint Scheduler every 15 minutes
Requires=hf-endpoint-scheduler.service

[Timer]
OnCalendar=*:0/15
Persistent=true

[Install]
WantedBy=timers.target
EOF

    # Enable timer (but don't start - let user decide)
    sudo systemctl daemon-reload
    echo "✅ Systemd timer created (not started)"
    echo ""
    echo "To use systemd instead of cron:"
    echo "  sudo systemctl enable --now hf-endpoint-scheduler.timer"
fi

# Create cost monitoring script
cat > "$SCRIPT_DIR/monitor-hf-costs.sh" << 'EOF'
#!/bin/bash
# Monitor HuggingFace endpoint costs

LOGFILE="$HOME/.hf-scheduler/cost-report.log"
mkdir -p "$(dirname "$LOGFILE")"

echo "=== HuggingFace Cost Report - $(date) ===" >> "$LOGFILE"

# Get endpoint status
python3 "$(dirname "$0")/manage-hf-endpoints.py" list >> "$LOGFILE" 2>&1

# Estimate daily costs
echo "" >> "$LOGFILE"
echo "Estimated Daily Costs (based on current config):" >> "$LOGFILE"
echo "- Fast tier (L40 S): $1.80/hour * 14 hours = $25.20/day" >> "$LOGFILE"
echo "- Quality tier (H100): $0 (cold start only)" >> "$LOGFILE"
echo "- Weekend savings: $43.20 (2 days * 24 hours * $1.80)" >> "$LOGFILE"

# Show last 24h of scheduler activity
echo "" >> "$LOGFILE"
echo "Last 24h scheduler activity:" >> "$LOGFILE"
grep "$(date -d '1 day ago' '+%Y-%m-%d')" /var/log/hf-scheduler.log 2>/dev/null || \
grep "$(date -d '1 day ago' '+%Y-%m-%d')" "$HOME/.hf-scheduler/hf-scheduler.log" 2>/dev/null || \
echo "No activity found" >> "$LOGFILE"

cat "$LOGFILE"
EOF

chmod +x "$SCRIPT_DIR/monitor-hf-costs.sh"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "✅ Cron jobs installed"
echo "✅ Cost monitoring script created"
echo ""
echo "Schedule Summary:"
echo "- Endpoints checked every 15 minutes"
echo "- Fast tier paused at 10 PM UTC daily"
echo "- Fast tier resumed at 8 AM UTC on weekdays"
echo "- Scaled to 0 replicas on weekends"
echo "- Health checks hourly during work hours"
echo ""
echo "Commands:"
echo "- View cron jobs: crontab -l"
echo "- Monitor costs: $SCRIPT_DIR/monitor-hf-costs.sh"
echo "- View logs: tail -f $LOG_DIR/hf-scheduler.log"
echo "- Test scheduler: python3 $SCHEDULER_SCRIPT --action check --dry-run"
echo ""
echo "Estimated monthly savings: ~$172.80 (nights + weekends)"
