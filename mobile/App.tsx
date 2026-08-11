import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const SUPABASE_URL = "https://yaywauauqzfcmrzmbdkr.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlheXdhdWF1cXpmY21yem1iZGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTQ4MTQsImV4cCI6MjA3NzQ3MDgxNH0.IRA92oEpvvFBEOJaJ-w4v9XURjgg27ya9pk_xHcDb9A";
const TRACKING_STORAGE_KEY = "lb.native.tracking-token";

type Product = { id:string;slug:string;name:string;category:string;description:string;price:number;image_url:string|null;badge:string|null;is_available:boolean };
type Cart = Record<string,number>;
type ViewName = "menu"|"cart"|"checkout"|"track";
type CreatedOrder = { id:string;order_number:number;tracking_token:string;created_at:string;status:string;total:number;scheduled_for:string|null };
type TrackedOrder = { id:string;order_number:number;status:string;fulfilment:string;payment_status:string;total:number;events:{label:string;created_at:string}[] };

async function rpc<T>(fn:string,body:Record<string,unknown>):Promise<T>{
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:ANON_KEY,Authorization:`Bearer ${ANON_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const text=await response.text();
  const data=text?JSON.parse(text):null;
  if(!response.ok)throw new Error(data?.message??data?.hint??`Request failed (${response.status})`);
  return data as T;
}
const money=(value:number)=>`Rs ${Math.round(value||0).toLocaleString("en-PK")}`;

export default function App(){
  const[view,setView]=useState<ViewName>("menu");
  const[products,setProducts]=useState<Product[]>([]);
  const[cart,setCart]=useState<Cart>({});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[name,setName]=useState("");
  const[phone,setPhone]=useState("");
  const[address,setAddress]=useState("");
  const[fulfilment,setFulfilment]=useState<"delivery"|"pickup">("delivery");
  const[scheduledFor,setScheduledFor]=useState("");
  const[referral,setReferral]=useState("");
  const[created,setCreated]=useState<CreatedOrder|null>(null);
  const[trackingToken,setTrackingToken]=useState("");
  const[tracked,setTracked]=useState<TrackedOrder|null>(null);
  const[submitting,setSubmitting]=useState(false);

  const loadMenu=async()=>{setLoading(true);setError("");try{setProducts((await rpc<Product[]>("lb_public_menu",{})).filter(item=>item.is_available));}catch(cause){setError(cause instanceof Error?cause.message:"Could not load menu");}finally{setLoading(false);}};
  useEffect(()=>{void loadMenu();void AsyncStorage.getItem(TRACKING_STORAGE_KEY).then(token=>{if(token){setTrackingToken(token);setView("track");}}).catch(()=>{});},[]);

  const lines=useMemo(()=>products.filter(p=>(cart[p.slug]??0)>0).map(p=>({product:p,quantity:cart[p.slug]})),[products,cart]);
  const count=lines.reduce((sum,line)=>sum+line.quantity,0);
  const subtotal=lines.reduce((sum,line)=>sum+line.product.price*line.quantity,0);
  const setQty=(slug:string,qty:number)=>setCart(current=>({...current,[slug]:Math.max(0,Math.min(10,qty))}));

  const refresh=async(token=trackingToken)=>{
    if(!token.trim()){setError("Enter a tracking token.");return;}
    setError("");
    try{
      const result=await rpc<TrackedOrder|null>("lb_track_order",{p_tracking_token:token.trim()});
      if(!result)throw new Error("Order not found.");
      setTracked(result);
      setTrackingToken(token.trim());
      await AsyncStorage.setItem(TRACKING_STORAGE_KEY,token.trim());
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not track order");}
  };

  useEffect(()=>{if(view!=="track"||!trackingToken)return;void refresh(trackingToken);const id=setInterval(()=>void refresh(trackingToken),15000);return()=>clearInterval(id);},[view,trackingToken]);

  const place=async()=>{
    setError("");
    if(!name.trim()||!phone.trim()||(fulfilment==="delivery"&&!address.trim())||!lines.length){setError("Complete your details and basket first.");return;}
    setSubmitting(true);
    try{
      let scheduleIso:string|null=null;
      if(scheduledFor.trim()){
        const parsed=new Date(scheduledFor);
        const ts=parsed.getTime();
        if(Number.isNaN(ts))throw new Error("Use a valid ISO date/time, for example 2026-08-12T19:30:00+05:00");
        if(ts<Date.now()+30*60*1000)throw new Error("Scheduled orders must be at least 30 minutes ahead.");
        if(ts>Date.now()+7*24*60*60*1000)throw new Error("Scheduled orders can be placed up to 7 days ahead.");
        scheduleIso=parsed.toISOString();
      }
      const result=await rpc<CreatedOrder>("lb_create_order_v2",{p_customer_name:name,p_customer_phone:phone,p_delivery_address:address,p_fulfilment:fulfilment,p_payment_method:"cash",p_items:lines.map(line=>({slug:line.product.slug,quantity:line.quantity})),p_source:"native_app",p_scheduled_for:scheduleIso,p_referral_code:referral.trim()||null});
      await AsyncStorage.setItem(TRACKING_STORAGE_KEY,result.tracking_token);
      setCreated(result);setTrackingToken(result.tracking_token);setCart({});setView("track");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not place order");}
    finally{setSubmitting(false);}
  };

  const forgetTracking=async()=>{await AsyncStorage.removeItem(TRACKING_STORAGE_KEY);setTrackingToken("");setTracked(null);setCreated(null);setView("menu");};

  return <SafeAreaView style={styles.safe}><StatusBar style="dark"/>
    <View style={styles.header}><View><Text style={styles.brand}>London Bite</Text><Text style={styles.tag}>EVERY BITE IS A LONDON STORY</Text></View><Pressable style={styles.bag} onPress={()=>setView("cart")}><Text style={styles.bagText}>Bag {count}</Text></Pressable></View>
    <View style={styles.tabs}>{(["menu","cart","checkout","track"] as ViewName[]).map(item=><Pressable key={item} style={[styles.tab,view===item&&styles.tabActive]} onPress={()=>setView(item)}><Text style={[styles.tabText,view===item&&styles.tabTextActive]}>{item.toUpperCase()}</Text></Pressable>)}</View>
    {error?<Text style={styles.error}>{error}</Text>:null}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {view==="menu"&&<>{loading?<ActivityIndicator size="large" color="#07182f"/>:<><Text style={styles.kicker}>LIVE MENU</Text><Text style={styles.title}>Choose your next bite.</Text>{products.map(product=><View key={product.id} style={styles.card}>{product.image_url?<Image source={{uri:product.image_url}} style={styles.image}/>:null}<View style={styles.cardBody}><Text style={styles.category}>{product.category}</Text><View style={styles.row}><Text style={styles.productName}>{product.name}</Text><Text style={styles.price}>{money(product.price)}</Text></View><Text style={styles.description}>{product.description}</Text><Pressable style={styles.primary} onPress={()=>setQty(product.slug,(cart[product.slug]??0)+1)}><Text style={styles.primaryText}>Add to bag</Text></Pressable></View></View>)}</>}</>}
      {view==="cart"&&<><Text style={styles.kicker}>YOUR BAG</Text><Text style={styles.title}>{count?`${count} item${count===1?"":"s"}`:"Nothing added yet"}</Text>{lines.map(({product,quantity})=><View key={product.slug} style={styles.line}><View style={{flex:1}}><Text style={styles.productName}>{product.name}</Text><Text style={styles.description}>{money(product.price)} each</Text></View><View style={styles.qty}><Pressable onPress={()=>setQty(product.slug,quantity-1)}><Text style={styles.qtyButton}>−</Text></Pressable><Text style={styles.qtyValue}>{quantity}</Text><Pressable onPress={()=>setQty(product.slug,quantity+1)}><Text style={styles.qtyButton}>+</Text></Pressable></View></View>)}<View style={styles.total}><Text style={styles.productName}>Subtotal</Text><Text style={styles.productName}>{money(subtotal)}</Text></View>{count?<Pressable style={styles.primary} onPress={()=>setView("checkout")}><Text style={styles.primaryText}>Continue to checkout</Text></Pressable>:<Pressable style={styles.secondary} onPress={()=>setView("menu")}><Text style={styles.secondaryText}>Browse menu</Text></Pressable>}</>}
      {view==="checkout"&&<><Text style={styles.kicker}>GUEST CHECKOUT</Text><Text style={styles.title}>Fast, direct and server-priced.</Text><TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName}/><TextInput style={styles.input} placeholder="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone}/><View style={styles.row}><Pressable style={[styles.mode,fulfilment==="delivery"&&styles.modeActive]} onPress={()=>setFulfilment("delivery")}><Text style={fulfilment==="delivery"?styles.modeActiveText:styles.modeText}>Delivery</Text></Pressable><Pressable style={[styles.mode,fulfilment==="pickup"&&styles.modeActive]} onPress={()=>setFulfilment("pickup")}><Text style={fulfilment==="pickup"?styles.modeActiveText:styles.modeText}>Pickup</Text></Pressable></View>{fulfilment==="delivery"?<TextInput style={[styles.input,styles.multiline]} placeholder="Delivery address" multiline value={address} onChangeText={setAddress}/>:null}<TextInput style={styles.input} placeholder="Optional scheduled ISO time" value={scheduledFor} onChangeText={setScheduledFor}/><TextInput style={styles.input} placeholder="Optional referral code" autoCapitalize="characters" value={referral} onChangeText={setReferral}/><View style={styles.notice}><Text style={styles.noticeTitle}>Cash payment</Text><Text style={styles.description}>Online charging remains disabled until the restaurant activates a real merchant account.</Text></View><Pressable style={[styles.primary,submitting&&styles.disabled]} disabled={submitting} onPress={()=>void place()}><Text style={styles.primaryText}>{submitting?"Sending order…":"Place cash order"}</Text></Pressable></>}
      {view==="track"&&<><Text style={styles.kicker}>PRIVATE TRACKING</Text><Text style={styles.title}>{tracked?`LB #${tracked.order_number}`:created?`LB #${created.order_number}`:"Track an order"}</Text><TextInput style={styles.input} placeholder="Tracking token" autoCapitalize="none" value={trackingToken} onChangeText={setTrackingToken}/><Pressable style={styles.primary} onPress={()=>void refresh()}><Text style={styles.primaryText}>Refresh status</Text></Pressable>{tracked?<View style={styles.trackCard}><Text style={styles.trackStatus}>{tracked.status.replaceAll("_"," ").toUpperCase()}</Text><Text style={styles.description}>{tracked.fulfilment} · {money(Number(tracked.total))}</Text>{tracked.events?.map((event,index)=><View key={`${event.created_at}-${index}`} style={styles.event}><Text style={styles.eventLabel}>{event.label}</Text><Text style={styles.eventTime}>{new Date(event.created_at).toLocaleString()}</Text></View>)}</View>:null}<Pressable style={styles.secondary} onPress={()=>void forgetTracking()}><Text style={styles.secondaryText}>Forget saved tracking</Text></Pressable></>}
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:"#f4f5f2"},header:{paddingHorizontal:18,paddingTop:14,paddingBottom:10,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},brand:{fontSize:22,fontWeight:"900",color:"#07182f"},tag:{marginTop:2,fontSize:8,fontWeight:"800",letterSpacing:1.2,color:"#657080"},bag:{backgroundColor:"#07182f",borderRadius:999,paddingHorizontal:16,paddingVertical:11},bagText:{color:"white",fontSize:11,fontWeight:"900"},tabs:{flexDirection:"row",marginHorizontal:14,padding:5,borderRadius:18,backgroundColor:"white"},tab:{flex:1,paddingVertical:10,borderRadius:14,alignItems:"center"},tabActive:{backgroundColor:"#07182f"},tabText:{fontSize:8,fontWeight:"900",color:"#657080"},tabTextActive:{color:"white"},error:{marginHorizontal:18,marginTop:10,borderRadius:14,padding:12,backgroundColor:"#fff0f0",color:"#b42318",fontWeight:"700",fontSize:12},content:{padding:18,paddingBottom:48},kicker:{fontSize:9,fontWeight:"900",letterSpacing:1.6,color:"#cc2634"},title:{fontSize:30,lineHeight:32,fontWeight:"900",letterSpacing:-1.2,color:"#07182f",marginTop:5,marginBottom:18},card:{backgroundColor:"white",borderRadius:26,overflow:"hidden",marginBottom:14},image:{width:"100%",height:210,backgroundColor:"#e9edf2"},cardBody:{padding:16},category:{fontSize:9,fontWeight:"900",letterSpacing:1.2,color:"#cc2634",textTransform:"uppercase"},row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},productName:{fontSize:16,fontWeight:"900",color:"#07182f",flexShrink:1},price:{fontSize:14,fontWeight:"900",color:"#07182f"},description:{fontSize:12,lineHeight:18,color:"#657080",marginTop:6},primary:{marginTop:14,minHeight:50,borderRadius:16,backgroundColor:"#07182f",alignItems:"center",justifyContent:"center",paddingHorizontal:16},primaryText:{color:"white",fontWeight:"900",fontSize:12},secondary:{marginTop:14,minHeight:50,borderRadius:16,backgroundColor:"white",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#dce1e7"},secondaryText:{color:"#07182f",fontWeight:"900",fontSize:12},line:{flexDirection:"row",alignItems:"center",gap:14,backgroundColor:"white",borderRadius:20,padding:15,marginBottom:9},qty:{flexDirection:"row",alignItems:"center",gap:12},qtyButton:{width:32,height:32,textAlign:"center",textAlignVertical:"center",fontSize:20,fontWeight:"900",color:"#07182f",backgroundColor:"#f1f3f5",borderRadius:16},qtyValue:{fontSize:13,fontWeight:"900",color:"#07182f"},total:{marginTop:10,paddingTop:16,borderTopWidth:1,borderTopColor:"#dce1e7",flexDirection:"row",justifyContent:"space-between"},input:{minHeight:52,borderRadius:16,backgroundColor:"white",borderWidth:1,borderColor:"#e2e6ea",paddingHorizontal:15,fontSize:14,color:"#07182f",marginBottom:10},multiline:{minHeight:100,paddingTop:14,textAlignVertical:"top"},mode:{flex:1,minHeight:48,borderRadius:15,backgroundColor:"white",alignItems:"center",justifyContent:"center",marginBottom:10},modeActive:{backgroundColor:"#07182f"},modeText:{fontSize:11,fontWeight:"900",color:"#657080"},modeActiveText:{fontSize:11,fontWeight:"900",color:"white"},notice:{borderRadius:18,backgroundColor:"white",padding:15,marginTop:4},noticeTitle:{fontSize:13,fontWeight:"900",color:"#07182f"},disabled:{opacity:.55},trackCard:{marginTop:14,borderRadius:24,backgroundColor:"white",padding:18},trackStatus:{fontSize:22,fontWeight:"900",color:"#07182f"},event:{borderTopWidth:1,borderTopColor:"#eef0f2",paddingTop:12,marginTop:12},eventLabel:{fontSize:12,fontWeight:"800",color:"#07182f"},eventTime:{fontSize:10,color:"#657080",marginTop:3}});
