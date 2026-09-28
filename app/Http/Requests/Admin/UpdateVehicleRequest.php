<?php

namespace App\Http\Requests\Admin;

class UpdateVehicleRequest extends StoreVehicleRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        // Same rules as create; slug stays immutable so booking
        // history and public URLs never break on rename.
        return parent::rules();
    }
}
