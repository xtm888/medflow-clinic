---
name: find-patient
description: Search for a patient by name, ID, or phone number
args: search_term
---

# Find Patient

Search for a patient using the provided term (name, patient ID, or phone):

```bash
SEARCH="$ARGUMENTS"

mongosh medflow --eval "
  const search = '$SEARCH';
  print('Searching for: ' + search);
  print('');

  const results = db.patients.find({
    \$or: [
      {patientId: search},
      {patientId: new RegExp(search, 'i')},
      {lastName: new RegExp(search, 'i')},
      {firstName: new RegExp(search, 'i')},
      {phone: new RegExp(search)}
    ]
  }).limit(10).toArray();

  if (results.length === 0) {
    print('No patients found matching: ' + search);
  } else {
    print('Found ' + results.length + ' patient(s):');
    print('');
    results.forEach((p, i) => {
      print((i+1) + '. ' + p.patientId + ' - ' + (p.firstName || '') + ' ' + (p.lastName || ''));
      print('   Phone: ' + (p.phone || 'N/A'));
      print('   ID: ' + p._id);
      print('');
    });
  }
"
```

Display the search results with patient details.
