<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'student_id' => ['required', 'string', 'max:50', 'unique:users,student_id'],
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'course' => ['required', 'string', 'max:255'],
            'year' => ['required', 'string', 'max:50'],
            'section' => ['required', 'string', 'max:50'],
            'birthday' => ['required', 'date_format:Y-m-d'],
            'gender' => ['required', Rule::in(['male', 'female', 'other'])],
            'email' => [
                'required', 
                'email', 
                'max:255', 
                'unique:users,email',
                'regex:/@iskolarngbayan\.pup\.edu\.ph$/'
            ],
            'mobile_number' => ['required', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ];
    }

    public function messages(): array
    {
        return [
            'student_id.required' => 'Student ID is required.',
            'student_id.unique' => 'This Student ID is already registered.',
            'first_name.required' => 'First name is required.',
            'last_name.required' => 'Last name is required.',
            'course.required' => 'Course is required.',
            'year.required' => 'Year level is required.',
            'section.required' => 'Section is required.',
            'birthday.required' => 'Birthday is required.',
            'birthday.date_format' => 'Invalid birthday format.',
            'gender.required' => 'Gender is required.',
            'gender.in' => 'Gender must be male, female, or other.',
            'email.required' => 'Email address is required.',
            'email.email' => 'Please enter a valid email address.',
            'email.unique' => 'This email is already registered.',
            'email.regex' => 'Please use your PUP Webmail (@iskolarngbayan.pup.edu.ph).',
            'mobile_number.required' => 'Phone number is required.',
            'password.required' => 'Password is required.',
            'password.min' => 'Password must be at least 8 characters.',
            'password.confirmed' => 'Passwords do not match.',
        ];
    }
}