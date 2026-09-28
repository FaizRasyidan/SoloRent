<?php

test('guest is blocked from dashboard reports insights and export', function () {
    $this->get('/admin/dashboard')->assertRedirect(route('admin.login'));
    $this->get('/admin/reports?tab=insights')->assertRedirect(route('admin.login'));
    $this->get('/admin/reports/export?report=insights')->assertRedirect(route('admin.login'));
    $this->post('/admin/insights/refresh')->assertRedirect(route('admin.login'));
});

test('non-admin is forbidden from insights and refresh', function () {
    $this->actingAs(makeCustomer());

    $this->get('/admin/dashboard')->assertForbidden();
    $this->get('/admin/reports?tab=insights')->assertForbidden();
    $this->get('/admin/reports/export?report=insights')->assertForbidden();
    $this->post('/admin/insights/refresh')->assertForbidden();
});

test('admin can refresh insights cache', function () {
    $this->actingAs(makeAdmin());

    $this->post('/admin/insights/refresh')->assertRedirect();
    $this->post('/admin/insights/refresh', ['category' => 'motor'])->assertRedirect();
});
