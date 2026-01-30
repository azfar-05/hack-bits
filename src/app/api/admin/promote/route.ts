import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { email, secretKey } = await request.json();

    // Simple secret key protection (you can change this)
    if (secretKey !== "PROMOTE_ADMIN_SECRET_2024") {
      return NextResponse.json(
        { error: "Invalid secret key" },
        { status: 401 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find user by email
    let user = await db.user.findUnique({
      where: { email },
    });

    // If user doesn't exist, create them as admin with a default password
    if (!user) {
      const defaultPassword = "admin123"; // They can change this later
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);

      user = await db.user.create({
        data: {
          email,
          name: email.split("@")[0],
          role: "AUTHORITY",
          password: hashedPassword,
        },
      });

      return NextResponse.json({
        message: "Admin user created successfully",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        defaultPassword: defaultPassword,
      });
    }

    // If user exists, promote them to admin
    const updatedUser = await db.user.update({
      where: { email },
      data: { role: "AUTHORITY" },
    });

    return NextResponse.json({
      message: "User promoted to admin successfully",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Error promoting user to admin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
