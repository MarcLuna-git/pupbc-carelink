@component('mail::message')
# Confirm Your New Email

Hello {{ $user->first_name }},

Use this code to finish changing your CareLink email address:

@component('mail::panel')
# **{{ $otp }}**
@endcomponent

This code will expire in **10 minutes**.

If you did not ask to change your email, you can ignore this message.

Thanks,<br>
**PUPBC CareLink**
@endcomponent
