@component('mail::message')
# Password Reset

Hello {{ $user->first_name }},

Your password reset code is:

@component('mail::panel')
# **{{ $otp }}**
@endcomponent

This code will expire in **5 minutes**.

If you did not request a password reset, no further action is required.

Thanks,<br>
**PUPBC CareLink**
@endcomponent