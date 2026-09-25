<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>PUPBC CareLink appointment</title></head>
<body>
    <h1>{{ $title }}</h1>
    <p>{{ $eventMessage }}</p>
    @if ($reason)
        <p>Sign in to CareLink to view the reason securely.</p>
    @endif
    <p>Reference: {{ $referenceNumber }}</p>
    <p>Schedule: {{ $appointmentDate }} at {{ $timeSlot }} (Asia/Manila)</p>
    <p>Sign in to PUPBC CareLink to view your appointments and notifications.</p>
</body>
</html>
