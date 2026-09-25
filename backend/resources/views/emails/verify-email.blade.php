@component('mail::message')
# Email Verification

Hello {{ $user->first_name }},

Your verification code is:

@component('mail::panel')
# **{{ $otp }}**
@endcomponent

This code will expire in **5 minutes**.

If you did not create an account, no further action is required.

Thanks,<br>
**PUPBC CareLink**
@endcomponent