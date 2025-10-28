    //server\modals\Conversation.ts

    import { model, Schema } from "mongoose"
    import { ConversationProps } from "../types"
    import { getCustomerConnection } from "../config/db";

    const ConversationSchema = new Schema<ConversationProps>({
        type: {
            type: String,
            enum: ['direct'], // Only direct 1-on-1 messaging (customer ↔ operator)
            default: 'direct',
            required: true,
        },
        name: String,
        participants: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true
            }
        ],
        lastMessage: {
            type: Schema.Types.ObjectId,
            ref: "Message",
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        avatar: {
            type: String,
            default: "",
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        }
    });

    ConversationSchema.pre("save", function(next){
        this.updatedAt = new Date();
        next();
    });

    // Use customer connection for Conversation model
    const customer = getCustomerConnection();
    export default customer.model<ConversationProps>("Conversation", ConversationSchema);