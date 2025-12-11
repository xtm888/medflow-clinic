# Medical Imaging Data

## Current Status
The current images are placeholders to demonstrate functionality. To add real medical images:

## Adding Real OCT/Fundus Images

### Option 1: From Kaggle Datasets
```bash
# Install Kaggle CLI
pip install kaggle

# Download retinal OCT dataset
kaggle datasets download -d paultimothymooney/kermany2018
unzip kermany2018.zip -d oct_fundus_sample/

# Or download MESSIDOR fundus dataset
kaggle datasets download -d google-brain/messidor2-dr-grades
unzip messidor2-dr-grades.zip -d oct_fundus_sample/
```

### Option 2: From Public Medical Image Repositories

1. **NIH National Library of Medicine Open-i**
   - Visit: https://openi.nlm.nih.gov/
   - Search for "retinal oct" or "fundus photography"
   - Download and place in `oct_fundus_sample/`

2. **STARE Database** (fundus images)
   - Visit: http://cecas.clemson.edu/~ahoover/stare/
   - Download retinal images
   - Place in `oct_fundus_sample/`

3. **DRIVE Database** (fundus images)
   - Visit: https://drive.grand-challenge.org/
   - Register and download dataset
   - Place in `oct_fundus_sample/`

### Option 3: Manual Download
Place your JPG/PNG images in:
- `/backend/public/images_ophta/oct_fundus_sample/`

Then update the seed script paths in:
- `/backend/scripts/seedImagingData.js`

## DICOM Files
For DICOM support, place .dcm files in:
- `/backend/public/images_ophta/dicom_sample/`

## Supported Formats
- JPG, PNG for OCT and fundus images
- DCM for DICOM files
