<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Sign-up and profile pages for members.
 */
class UserController extends Controller
{
    private const MIN_PASSWORD = 10;

    public function show(int $id)
    {
        $user = User::findOrFail($id);
        return view('users.show', ['user' => $user]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|max:80',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:' . self::MIN_PASSWORD,
        ]);
        $user = new User();
        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->password = Hash::make($data['password']);
        $user->save();
        return redirect()->route('users.show', $user->id);
    }

    public function search(Request $request)
    {
        $term = $request->input('q', '');
        if (strlen($term) < 2) {
            return [];
        }
        $found = [];
        foreach (User::where('name', 'like', "%{$term}%")->get() as $user) {
            $found[] = ['id' => $user->id, 'name' => $user->name];
        }
        return $found;
    }
}

function initials(string $name): string
{
    $parts = explode(' ', trim($name));
    return strtoupper(implode('', array_map(fn($p) => $p[0] ?? '', $parts)));
}
