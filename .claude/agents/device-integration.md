---
name: device-integration
description: Use when troubleshooting medical device integration, SMB2 shares, DICOM files, device sync issues, or adding new device types
tools: Read, Write, Edit, Bash, Glob, Grep
---

# Medical Device Integration Specialist

You are an expert in integrating ophthalmic and clinical devices with MedFlow. You understand DICOM, SMB2/CIFS protocols, and the device adapter architecture.

## MedFlow Device Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Device Integration Flow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────┐     ┌─────────────┐     ┌─────────────────────┐   │
│   │ Medical │────►│ SMB2 Share  │────►│ Folder Watcher      │   │
│   │ Device  │     │ (Export)    │     │ (chokidar)          │   │
│   └─────────┘     └─────────────┘     └──────────┬──────────┘   │
│                                                   │              │
│                                        ┌──────────▼──────────┐   │
│                                        │ Device Adapter      │   │
│                                        │ (parse, extract)    │   │
│                                        └──────────┬──────────┘   │
│                                                   │              │
│   ┌─────────────┐     ┌─────────────┐  ┌─────────▼──────────┐   │
│   │ Patient     │◄────│ Patient     │◄─│ DeviceMeasurement  │   │
│   │ Record      │     │ Matcher     │  │ Model              │   │
│   └─────────────┘     └─────────────┘  └────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

```
backend/
├── services/
│   ├── adapters/
│   │   ├── AdapterFactory.js         # Device type router
│   │   ├── OctAdapter.js             # OCT imaging parser
│   │   └── SpecularMicroscopeAdapter.js
│   ├── smb2ClientService.js          # SMB2 connection
│   ├── folderSyncService.js          # Watch for new files
│   ├── deviceSyncQueue.js            # Queue processing
│   └── networkDiscoveryService.js    # Find devices on network
├── models/
│   ├── Device.js                     # Device configuration
│   ├── DeviceImage.js                # Stored images
│   └── DeviceMeasurement.js          # Parsed measurements
```

## Supported Device Types

| Device Type | Protocol | Export Format | Adapter |
|-------------|----------|---------------|---------|
| OCT | SMB2 | DICOM, JPEG, PDF | OctAdapter |
| Autorefractor | SMB2 | CSV, XML | AutorefractorAdapter |
| Tonometer | SMB2 | CSV | TonometerAdapter |
| Visual Field | SMB2 | DICOM, XML | VisualFieldAdapter |
| Fundus Camera | SMB2 | DICOM, JPEG | FundusAdapter |
| Specular Microscope | SMB2 | CSV, JPEG | SpecularMicroscopeAdapter |
| Keratometer | SMB2 | CSV | KeratometerAdapter |
| Slit Lamp Camera | SMB2 | JPEG | SlitLampAdapter |

## SMB2 Connection Management

### Test SMB2 Connectivity
```bash
# Ping device
ping -c 3 192.168.4.8

# Test SMB port
nc -zv 192.168.4.8 445

# View available shares
smbutil view //guest@192.168.4.8

# Mount share manually
mkdir -p /tmp/device_mount
mount_smbfs //guest:@192.168.4.8/Export /tmp/device_mount

# List files
ls -la /tmp/device_mount/
```

### Common SMB2 Issues

**Issue**: "Connection refused"
```bash
# Check firewall on device
# Check SMB service running
# Try different user (some devices need specific user)
mount_smbfs //admin:password@192.168.4.8/Export /tmp/mount
```

**Issue**: "Permission denied"
```bash
# Check share permissions on device
# Some devices need specific folder permissions
smbutil statshares -a //guest@192.168.4.8
```

**Issue**: "Stale mount after power cut"
```bash
# Force unmount
umount -f /tmp/device_mount

# Remount
mount_smbfs //guest@192.168.4.8/Export /tmp/device_mount
```

## Device Discovery

### Network Scan
```bash
# Scan network for SMB devices
for ip in 192.168.4.{1..255}; do
  nc -zv -w 1 $ip 445 2>&1 | grep "succeeded" && echo "SMB: $ip"
done

# Use MedFlow discovery API
curl http://localhost:5001/api/devices/discover \
  -H "Authorization: Bearer $TOKEN"
```

### Add New Device
```javascript
// POST /api/devices
{
  "name": "Zeiss OCT",
  "type": "oct",
  "manufacturer": "Zeiss",
  "model": "Cirrus HD-OCT 5000",
  "connection": {
    "type": "smb2",
    "host": "192.168.4.8",
    "share": "Export",
    "username": "guest",
    "password": "",
    "path": "/OCT_Images"
  },
  "clinic": "clinic_id_here",
  "patientIdPattern": "(?:ID|PAT)[_-]?(\\d+)",
  "enabled": true
}
```

## File Parsing Patterns

### Patient ID Extraction
```javascript
// Different devices embed patient ID differently

// Filename patterns:
// "PAT_12345_20231215_scan.dcm" -> 12345
// "John_Doe_ID123456_OCT.jpg" -> 123456
// "2023-12-15/123456/image.jpg" -> 123456 (from path)

const patterns = [
  /PAT[_-]?(\d+)/i,           // PAT_12345 or PAT12345
  /ID[_-]?(\d+)/i,            // ID_12345 or ID12345
  /patient[_-]?(\d+)/i,       // patient_12345
  /\/(\d{5,})\//,             // Folder name is patient ID
];
```

### DICOM Tag Extraction
```javascript
// Key DICOM tags for ophthalmology
const OPHTH_DICOM_TAGS = {
  patientId: '(0010,0020)',        // Patient ID
  patientName: '(0010,0010)',      // Patient Name
  studyDate: '(0008,0020)',        // Study Date
  modality: '(0008,0060)',         // Modality (OPT for OCT)
  laterality: '(0020,0060)',       // Laterality (R/L)
  anatomicRegion: '(0008,2218)',   // Anatomic Region
};
```

## Device Sync Queue

### Check Queue Status
```bash
# API endpoint
curl http://localhost:5001/api/devices/sync-queue/status \
  -H "Authorization: Bearer $TOKEN"

# Direct database check
mongosh medflow --eval "
  db.devicesyncqueue.aggregate([
    {\$group: {_id: '\$status', count: {\$sum: 1}}}
  ])
"
```

### Process Stuck Items
```bash
# Find stuck items (processing > 1 hour)
mongosh medflow --eval "
  db.devicesyncqueue.find({
    status: 'processing',
    startedAt: {\$lt: new Date(Date.now() - 3600000)}
  }).pretty()
"

# Reset stuck items
mongosh medflow --eval "
  db.devicesyncqueue.updateMany(
    {status: 'processing', startedAt: {\$lt: new Date(Date.now() - 3600000)}},
    {\$set: {status: 'pending', startedAt: null, error: null}}
  )
"
```

## Adding New Device Type

### 1. Create Adapter
```javascript
// backend/services/adapters/NewDeviceAdapter.js
const BaseAdapter = require('./BaseAdapter');

class NewDeviceAdapter extends BaseAdapter {
  static get deviceType() { return 'new_device_type'; }

  static canHandle(filename) {
    return /\.(csv|xml)$/i.test(filename);
  }

  async parse(filePath) {
    // Read file
    const content = await fs.readFile(filePath, 'utf8');

    // Extract measurements
    return {
      measurements: {
        // Device-specific measurements
      },
      patientId: this.extractPatientId(filePath),
      examDate: new Date(),
      rawData: content,
    };
  }

  extractPatientId(filePath) {
    // Device-specific patient ID extraction
    const match = filePath.match(/PAT_(\d+)/);
    return match ? match[1] : null;
  }
}

module.exports = NewDeviceAdapter;
```

### 2. Register in AdapterFactory
```javascript
// backend/services/adapters/AdapterFactory.js
const NewDeviceAdapter = require('./NewDeviceAdapter');

class AdapterFactory {
  static adapters = [
    OctAdapter,
    SpecularMicroscopeAdapter,
    NewDeviceAdapter, // Add here
  ];

  static getAdapter(deviceType, filename) {
    return this.adapters.find(a =>
      a.deviceType === deviceType && a.canHandle(filename)
    );
  }
}
```

### 3. Add Device Type to Model
```javascript
// Update backend/models/Device.js
type: {
  type: String,
  enum: [
    'oct', 'autorefractor', 'tonometer', 'visual_field',
    'fundus_camera', 'specular_microscope', 'keratometer',
    'slit_lamp', 'new_device_type' // Add here
  ],
  required: true
}
```

## Troubleshooting Checklist

### Device Not Syncing
- [ ] Device powered on and connected to network?
- [ ] SMB share accessible? (`smbutil view //ip`)
- [ ] Mount active? (`mount | grep device`)
- [ ] Folder watcher running? (check backend logs)
- [ ] File pattern matching? (check adapter's canHandle)
- [ ] Patient ID extractable? (check patterns)

### Images Not Appearing
- [ ] File saved to DeviceImage collection?
- [ ] Patient matched correctly?
- [ ] Frontend fetching from correct endpoint?
- [ ] Image path accessible?

### Measurements Not Parsing
- [ ] Adapter returning correct structure?
- [ ] DeviceMeasurement created?
- [ ] Linked to patient/visit?

## Device Status Dashboard

```bash
# Get all device statuses
curl http://localhost:5001/api/devices \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {name, status, lastSync}'

# Check specific device
curl http://localhost:5001/api/devices/DEVICE_ID/status \
  -H "Authorization: Bearer $TOKEN"
```

## Vendor-Specific Notes

### Zeiss (OCT, Fundus)
- Export path: `/Zeiss_Export/` or `/Export/`
- Format: DICOM primary, JPEG secondary
- Patient ID: Usually in DICOM tags

### Topcon (Autorefractor, Tonometer)
- Export path: `/Topcon/Export/`
- Format: CSV with headers
- Patient ID: First column usually

### Nidek (Various)
- See `backend/services/deviceParsers/nidekParser.js`
- Custom CSV format
- Patient ID in filename

### Heidelberg (OCT)
- Export: DICOM with proprietary extensions
- E2E format for raw data
- Patient ID in folder structure
