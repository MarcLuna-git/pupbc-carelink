<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'limit' => 'nullable|integer|min:1|max:50',
            'page' => 'nullable|integer|min:1',
        ]);

        $limit = (int) (
            $validated['limit'] ?? 20
        );

        $userId = auth()->id();

        $notifications =
            Notification::where(
                'user_id',
                $userId
            )
                ->orderBy(
                    'created_at',
                    'desc'
                )
                ->paginate($limit);

        $unreadCount =
            Notification::where(
                'user_id',
                $userId
            )
                ->where(
                    'read',
                    false
                )
                ->count();

        return response()->json([
            'success' => true,
            'data' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    public function markAsRead($id)
    {
        $notification =
            Notification::where(
                'id',
                $id
            )
                ->where(
                    'user_id',
                    auth()->id()
                )
                ->first();

        if (!$notification) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Notification not found.',
            ], 404);
        }

        if (!$notification->read) {
            $notification->update([
                'read' => true,
                'read_at' => now(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' =>
                'Notification marked as read.',
            'data' => $notification->fresh(),
        ]);
    }

    public function markAllAsRead()
    {
        $updated =
            Notification::where(
                'user_id',
                auth()->id()
            )
                ->where(
                    'read',
                    false
                )
                ->update([
                    'read' => true,
                    'read_at' => now(),
                ]);

        return response()->json([
            'success' => true,
            'message' =>
                'All notifications marked as read.',
            'updated_count' => $updated,
            'unread_count' => 0,
        ]);
    }

    public function destroy($id)
    {
        $notification =
            Notification::where(
                'id',
                $id
            )
                ->where(
                    'user_id',
                    auth()->id()
                )
                ->first();

        if (!$notification) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Notification not found.',
            ], 404);
        }

        $notification->delete();

        $unreadCount =
            Notification::where(
                'user_id',
                auth()->id()
            )
                ->where(
                    'read',
                    false
                )
                ->count();

        return response()->json([
            'success' => true,
            'message' =>
                'Notification deleted.',
            'unread_count' => $unreadCount,
        ]);
    }
}
